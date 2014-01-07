/*
 * Breach: module_manager.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-13-14 spolu   Creation
 */
var async = require('async');
var fs = require('fs-extra');
var path = require('path');
var child_process = require('child_process');
var https = require('https');
var mkdirp = require('mkdirp');
var events = require('events');
var github = require('octonode');
var nedb = require('nedb');
var npm = require('npm');


var api = require('exo_browser');

var common = require('./common.js');

// ## module_manager
//
// This is the module management class. It exposes methods to init the module
// registry (local for now), check module status, search, add, install, remove
// and start modules.
//
// It also handles the communication between modules (events & RPC) and exposes
// hooks for Breach to expose the `breach/core` module.
//
// A module manager is associated with a session and manages all the running
// modules for that session.
//
// Module description format:
// ```
// {
//   module_id: 'breach/stack',
//   version: '0.1.2',
// }
// ```
//
// The module manager handles a dictionary of running module stored in
// `my.modules` with the given structure:
// ```
// my.modules[module_id] = {
//   process: null,
//   module: { module_id, version },
//   restart: 0,
//   registrations: []
// }
// ```
//
// ```
// @spec { session }
// ```
var module_manager = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.session = spec.session;

  /* The `modules_path` is the repository of public modules installed on this */
  /* machine. Modules are shared among users of a same machine.               */
  my.modules_path = path.join(api.data_path('breach'), 'modules');
  /* The `session_data_path` if not null (off_the_record), is used to store */
  /* and retrieve the modules information for the associated session.       */
  my.session_data_path = my.session.off_the_record() ? null : 
    path.join(my.session.data_path(), 'modules.db');

  my.db = null;
  my.github = github.client();

  my.modules = {};
  my.pending_modules = {};

  my.core_module = {
    module_id: 'breach/core',
    procedures: {},
    message_id: 0
  };

  //
  // #### _public_
  // 
  var init;            /* init(cb_); */
  var kill;            /* stop(cb_); */

  var core_expose;     /* core_expose(proc, fun); */
  var core_emit;       /* core_emit(type, evt); */

  var add_module;      /* add_module(module_id, version, cb_); */
  var remove_module;   /* remove_module(module_id, version, cb_); */

  //
  // #### _private_
  // 
  var module_path;     /* module_path(module); */
  var extract_path;    /* extract_path(module); */
  var clean_extract;   /* clean_extract(module, cb_); */

  var check_module;    /* check_modules(module, cb_); */
  var install_module;  /* install_module(module, cb_); */
  var update_module;   /* update_module(module, cb_); */

  var start_module;    /* start_module(module, cb_); */
  var stop_module;     /* stop_module(module, cb_); */

  var dispatch;        /* dispatch(module, msg); */


  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* HELPERS */
  /****************************************************************************/
  // ### module_path
  //
  // Computes the path for a module given a module description object
  // ```
  // @module {object} a module description object
  // ```
  module_path = function(module) {
    return path.join(my.modules_path, 
                     module.module_id.split('/')[0],
                     module.module_id.split('/')[1] + 
                     '@' + module.version);
  };

  // ### extract_path
  //
  // Computes the extract path for a module given a module description object
  // ```
  // @module {object} a module description object
  // ```
  extract_path = function(module) {
    if(module) {
      return path.join(my.modules_path, 'extract',
                       module.module_id.split('/')[0] + '_' +
                       module.module_id.split('/')[1] + 
                       '@' + module.version);
    }
    else {
      return path.join(my.modules_path, 'extract');
    }
  };

  // ### clean_extract
  //
  // Cleans up the extract path of a module or the whole extract path if no
  // module is specified
  // ```
  // @module {object} a module description object
  // @cb_    {function(err)}
  // ```
  clean_extract = function(module, cb_) {
    return fs.remove(extract_path(module), cb_);
  };

  /****************************************************************************/
  /* MODULE ACTIONS */
  /****************************************************************************/
  // ### check_module
  //
  // Checks the presence in the module in the local module directory and returns
  // a status value. If the module is here, it means it has been correctly
  // installed (see `install_module`).
  // ```
  // @module {object} a module description object
  // @cb_    {function(err, status)}
  // ```
  check_module = function(module, cb_) {
    if(module.module_id.split('/').length !== 2) {
      return cb_(common.error('Invalid `module_id`: ' + module.module_id,
                              'invalid_module_id'), 'failed');
    }
    var package_path = path.join(module_path(module), 'package.json');
    fs.readFile(package_path, function(err, data) {
      if(err) {
        return cb_(null, 'missing');
      }
      var package = null;
      try {
        package = JSON.parse(data);
      }
      catch(err) {
        return cb_(common.error('Invalid `package.json` ' + 
                                '[' + module.module_id + ']',
                                'invalid_package'), 'failed')
        return cb_(err, 'failed');
      }
      if(package.version !== module.version) {
        return cb_(common.error('Version mismatch ' + 
                                '[' + module.module_id + ']: ' +
                                package.version + ' != ' + module.version,
                                'version_mismatch'), 'failed')
      }
      return cb_(null, 'ready');
    });
  };

  // ### install_module
  //
  // Installs a module in the local module directory. Download it and  performs 
  // an npm install on it. The install is taking place in the `extract` so
  // the module gets into its final directory only if everything went well.
  // ```
  // @module {object} a module description object
  // @cb_    {function(err)}
  // ```
  install_module = function(module, cb_) {
    if(module.module_id.split('/').length !== 2) {
      return cb_(common.error('Invalid `module_id`: ' + module.module_id,
                              'invalid_module_id'));
    }
    async.waterfall([
      /* Cleanup module path. */
      function(cb_) {
        return fs.remove(module_path(module), cb_);
      },
      /* Retrieves the module tarball url from GitHub by version tag. */
      function(cb_) {
        var version = module.version;
        common.log.out('INSTALL: ' + module.module_id + 
                       '@' + module.version);
        var repo = my.github.repo(module.module_id);
        repo.tags(function(err, data) {
          var found = null;
          data.forEach(function(t) {
            if(t.name === 'v' + version) {
              found = t;
            }
          });
          if(!found) {
            return cb_(common.error('Module not found: ' + module.module_id + 
                                    '@' + module.version, 'module_notfound'));
          }
          return cb_(null, module.module_id + '#v' + module.version);
        });
      },
      /* Finally, run an npm install and move the installed module. */
      function(gh_url, cb_) {
        common.log.out('NPM INSTALL: ' + gh_url);
        clean_extract(module, function(err) {
          if(err) {
            return cb_(err);
          }
          npm.commands.install(extract_path(module), [gh_url], 
                               function(err, data) {
            if(err) {
              return cb_(common.error('Install error: ' + module.module_id + 
                                      '@' + module.version, 'npm_error'));
            }
            fs.readdir(path.join(extract_path(module), 'node_modules'), 
                       function(err, files) {
              if(err) {
                return cb_(err);
              }
              if(files.length !== 1) {
                return cb_(common.error('Install error' + module.module_id + 
                                        '@' + module.version, 'npm_error'));
              }
              else {
                fs.rename(path.join(extract_path(module), 
                                    'node_modules', files[0]),
                          module_path(module), function(err) {
                  if(err) {
                    return cb_(err);
                  }
                  return clean_extract(module, cb_);
                });
              }
            });
          });
        });
      }
    ], cb_);
  };

  // ### start_module
  //
  // Starts a module process and sets up all the message hooks needed. Calls the
  // exposed `init` method on the newly created method.
  // ```
  // @module {object} a module decsription object
  // @cb_    {function(err)}
  // ```
  start_module = function(module, cb_) {
    common.log.out('Module `start_module`: ' + module.module_id);
    my.modules[module.module_id] = my.modules[module.module_id] || {
      process: null,
      module: module,
      restart: 0,
      registrations: []
    };

    var p = child_process.fork(module_path(module), ['--no-chrome']);
    my.modules[module.module_id].process = p;

    p.on('exit', function(code) {
      /* For now all modules are supposed to be longlived. So any module */
      /* exiting is treated as an error and the module is restarted.     */
      common.log.out('Module exited unexpectedly: ' + module.module_id);
      p.removeAllListeners();
      if(my.modules[module.module_id].restart < 3) {
        common.log.out('Restarting: ' + module.module_id);
        my.modules[module.module_id].restart++;
        start_module(my.modules[module.module_id].module, function() {});
      }
      else {
        /* After 3 restarts we stop restarting the module. */
        delete my.modules[module.module_id];
      }
    });

    p.on('message', function(msg) {
      if(msg && msg.hdr && 
         typeof msg.hdr.typ === 'string' &&
         typeof msg.hdr.mid === 'number') {
        msg.hdr.src = module.module_id;
        dispatch(msg);
      }
      /* Otherwise we ignore the message. */
    });

    dispatch({
      hdr: { 
        typ: 'rpc_call', 
        src: my.core_module.module_id, 
        mid: ++my.core_module.message_id 
      },
      dst: module.module_id,
      prc: 'init'
    });

    return cb_();
  };

  // ### stop_module
  //
  // Stops a module by calling its `kill` method (with timeout) and finally
  // shutting down its process.
  // ```
  // @module {object} a module decsription object
  // @cb_    {function(err)}
  // ```
  stop_module = function(module, cb_) {
    common.log.out('Module `stop_module`: ' + module.module_id);
    if(my.modules[module.module_id]) {
      dispatch({
        hdr: { 
          typ: 'rpc_call', 
          src: my.core_module.module_id, 
          mid: ++my.core_module.message_id 
        },
        dst: module.module_id,
        prc: 'kill'
      });
      my.pending_modules[module.module_id] = my.modules[module.module_id];
      delete my.modules[module.module_id];

      /* We replace the `exit` listener so that the module does not get */
      /* restarted automatically once it exits.                         */
      my.pending_modules[module.module_id].process.removeAllListeners('exit');
      my.pending_modules[module.module_id].process.on('exit', function() {
        common.log.out('Module exited after `stop_module`: ' + 
                       module.module_id);
        my.pending_modules[module.module_id].process.removeAllListeners();
        delete my.pending_modules[module.module_id];
        return cb_();
      });

      /* A timeout is setup to kill the module if it failed to exit on its */
      /* own in the next 5s.                                               */
      setTimeout(function() {
        if(my.pending_modules[module.module_id]) {
          common.log.out('Module force kill: ' + module.module_id);
          my.pending_modules[module.module_id].process.kill();
        }
      }, 5 * 1000);
    }
    else {
      return cb_();
    }
  };

  /****************************************************************************/
  /* MESSAGE DISPATCH */
  /****************************************************************************/
  // ### dispatch
  //
  // Dispatches a message received from a module to where it is supposed to go
  // There are three types of messages: 
  // `event`      : event emitted and dispatched to registered modules
  // `register`   : registers for some events
  // `unregister` : unregisters an existing registration
  // `rpc_call`   : remote procedure call directed to a module
  // `rpc_reply`  : reply from a remote procedure call
  // ```
  // @msg {object} the message to dispatch
  // ```
  dispatch = function(msg) {
    console.log(JSON.stringify(msg));
    if(!msg || !msg.hdr || 
       typeof msg.hdr.typ !== 'string' ||
       typeof msg.hdr.mid !== 'number' ||
       typeof msg.hdr.src !== 'string' ||
       (!my.modules[msg.hdr.src] && 
        msg.hdr.src !== my.core_module.module_id)) {
      /* We ignore the message. */
      return;
    }


    /* This is the internal handler for rpc_calls targeted at the */
    /* `breach/core` module. They are executed out of the normal  */
    /* workflow with procedures registered with `core_expose`.    */
    var core_rpc_call = function(msg) {
      msg.oid = msg.hdr.mid;
      msg.hdr.src = my.core_module.module_id;
      msg.hdr.mid = ++my.core_module.message_id;
      if(my.core_module.procedures[msg.prc]) {
        my.core_module.procedures[msg.prc](msg.arg, function(err, res) {
          if(err)
            msg.err = { msg: err.message, nme: err.name };
          else
            msg.res = res;
          process.nextTick(dispatch(msg));
        });
      }
      else {
        msg.err = {
          msg: 'Procedure not found: `' + msg.prc + '`',
          nme: 'procedure_not_found'
        };
        process.nextTick(dispatch(msg));
      }
    };
       
    switch(msg.hdr.typ) {
      /* Modules register to each other events with the `register` message    */
      /* type. It creates a registration for the module issuing this mesage   */
      /* that will get tested against any event emitted. A `registration_id`  */
      /* is created from the `message_id`. Registration `src` and `typ` must  */
      /* string arguments to the RegExp object.                               */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'register', src: 'spolu/test', mid: 123, }             */
      /*   src: 'breach\/.*',                                                 */
      /*   typ: 'state:.*',                                                   */
      /* }                                                                    */
      /* ```                                                                  */
      case 'register': {
        if(typeof msg.src === 'string' && typeof msg.typ === 'string') {
          my.modules[msg.hdr.src].registrations.push({
            source: new RegExp(msg.src),
            type: new RegExp(msg.typ),
            registration_id: msg.hdr.mid
          });
          console.log('REGISTER: ' + msg.hdr.src);
          console.log(msg.src);
          console.log(msg.typ);
        }
        break;
      }
      /* Modules delete created registrations with the `unregister` message   */
      /* type.                                                                */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'register', src: 'spolu/test', mid: 137, }             */
      /*   rid: 123                                                           */
      /* }                                                                    */
      /* ```                                                                  */
      case 'unregister': {
        if(typeof msg.rid === 'number') {
          var registrations = my.modules[msg.hdr.src].registrations;
          for(var i = registrations.length - 1; i >= 0; i --) {
            if(registrations[i].registration_id === msg.rid) {
              registrations.splice(i, 1);
            }
          }
        }
        break;
      }
      /* Events are emitted by modules as messages with the `event` type.     */
      /* They are then tested against each module registrations and           */ 
      /* dispatched accordingly.                                              */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'event', src: 'breach/core', mid: 123, }               */
      /*   typ: 'state:change',                                               */
      /*   evt: { ... }                                                       */
      /* }                                                                    */
      /* ```                                                                  */
      case 'event': {
        for(var module_id in my.modules) {
          if(my.modules.hasOwnProperty(module_id)) {
            my.modules[module_id].registrations.forEach(function(r) {
              if(r.source.test(msg.hdr.src) &&
                 r.type.test(msg.typ) &&
                 msg.hdr.src !== module_id) {
                console.log('SEND [>' + module_id + ']: ' +
                            JSON.stringify(msg));
                my.modules[module_id].process.send(msg);
              }
            });
          }
        }
        break;
      }
      /* Modules perform remote procedure call by sending messages with the   */
      /* `rpc_call` type. The message is then forwarded to the appropriate    */
      /* module or handled here if it is targeted at the `breach/core` module */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'rpc_call', src: 'spolu/test', mid: 23 },              */
      /*   dst: 'breach/core',                                                */
      /*   prc: 'new_page',                                                   */
      /*   arg: { ... }                                                       */
      /* }                                                                    */
      /* ```                                                                  */
      case 'rpc_call': {
        msg.src = msg.hdr.src;
        /* All modules procedure handling. */
        if(my.modules[msg.dst] && my.modules[msg.hdr.src]) {
          my.modules[msg.dst].process.send(msg);
        }
        /* Core module procedure handling. */
        else if(msg.dst === my.core_module.module_id) {
          core_rpc_call(msg);
        }
        break;
      }
      /* Modules reply to an `rpc_call` message with a `rpc_reply` message    */
      /* type. The message payload is recycled and a `err` or `res` object is */
      /* added to it along with `oid` field (original message id) equal to    */
      /* the `mesage_id` of the original `rpc_call`.                          */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'rpc_reply', src: 'breach/core', mid: 248 },            */
      /*   dst: 'breach/core',                                                */
      /*   prc: 'new_page',                                                   */
      /*   arg: { ... }                                                       */
      /*   oid: 23,                                                           */
      /*   err: { msg: '', nme: '' }                                          */
      /*   res: { ... }                                                       */
      /* }                                                                    */
      /* ```                                                                  */
      case 'rpc_reply': {
        if(my.modules[msg.src]) {
          my.modules[msg.src].process.send(msg);
        }
        break;
      }
    }
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### core_expose
  //
  // Exposes a procedure on behalf of the core module
  // ```
  // @proc {string} procedure name
  // @fun  {function(args, cb_)} the actual procedure
  // ```
  core_expose = function(proc, fun) {
    my.core_module.procedures[proc] = fun;
  };

  // ### core_emit
  //
  // Emits an event on behalf of the core module
  // ```
  // @type  {string} event type
  // @event {object} serializable object
  // ```
  core_emit = function(type, event) {
    console.log('CORE_EMIT: ' + type + ' ' + JSON.stringify(event));
    dispatch({
      hdr: { 
        typ: 'event', 
        src: my.core_module.module_id, 
        mid: ++my.core_module.message_id 
      },
      typ: type,
      evt: event
    });
  };

  // ### add_module
  //
  // Indempotent. Adds the module to the module database + attemps to install it
  // TODO(spolu): Eventually remove version from API and add auto-update arg.
  // ```
  // @module_id {string} the module id `user/repo`
  // @version   {string} the module version
  // @start     {boolean} wether to start or not
  // @cb_       {function(err)}
  // ```
  add_module = function(module_id, version, start, cb_) {
    if(typeof module_id !== 'string' && module_id.split('/').length !== 2) {
      return cb_(common.error('Invalid `module_id`: ' + module_id));
    }
    if(typeof version !== 'string') {
      /* TODO(spolu): use `semver` check. */
      return cb_(common.error('Invalid `version`: ' + version));
    }
    var module = {
      module_id: module_id,
      version: version
    };
    async.series([
      /* Add the module to the module db. */
      function(cb_) {
        my.db.update({ 
          module_id: module_id,
        }, module, {
          upsert: true
        }, cb_);
      },
      function(cb_) {
        console.log(JSON.stringify(module));
        check_module(module, function(err, status) {
          if(err) {
            return cb_(err);
          }
          if(status === 'ready') {
            return cb_();
          }
          else if(status === 'missing') {
            install_module(module, cb_);
          }
        });
      },
      function(cb_) {
        if(start && !my.modules[module_id]) {
          start_module(module, cb_);
        }
        else {
          return cb_();
        }
      }
    ], cb_);
  };

  // ### remove_module
  //
  // Remove the module from the module database and delete it from filesystem.
  // TODO(spolu): Eventually remove version from API.
  // ```
  // @module_id {string} the module id `user/repo`
  // @version   {string} the module version
  // @stop      {boolean} attemps to stop the module
  // @cb_       {function(err, status)}
  // ```
  remove_module = function(module_id, version, stop, cb_) {
    async.series([
      /* Remove the module from the module db. */
      function(cb_) {
        my.db.remove({ 
          module_id: module_id,
        }, {
          multi: true
        }, cb_);
      },
      function(cb_) {
        fs.remove(module_path({
          module_id: module_id,
          version: version
        }), cb_);
      },
      function(cb_) {
        if(stop && my.modules[module_id]) {
          stop_module(module_id, cb_);
        }
        else {
          return cb_();
        }
      }
    ], cb_);
  };


  // ### init
  //
  // Inits the module manager and runs the bootup procedure
  //
  // The bootup procedure is as follows:
  // - Initialization of the module manager
  // - Checking if all modules are installed locally
  // - Install missing modules
  // - Start modules
  // - Asynchronoulsy check for updates
  //
  // Apart from starting the module, the rest of the bootup procedure is
  // user agnostic and operates on the shared local module repository.
  //
  // A module should never prevent the proper startup of the Browser.
  // ```
  // @cb_ {function(err)} asynchronous callback
  // @emits 'init:list', 'init:check', 'init:install', 'init:start', 'init:fail'
  // ```
  init = function(cb_) {
    var missing = [];
    var ready = [];
    var failed = [];
    
    async.series([
      /* Initialization. */
      function(cb_) {
        mkdirp(my.modules_path, function(err) {
          if(err) { 
            return cb_(err);
          }
          my.db = new nedb({ 
            filename: my.session_data_path, 
            autoload: true 
          });
          var now = Date.now();
          return npm.load({
            cache: path.join(extract_path(), 'npm_cache')
          },function(err) {
            if(err) {
              return cb_(err);
            }
            /* We clean the cache as it is causing some deadlocks some issues */
            /* when installing the same module multiple times (deadlock).     */
            /* TODO(spolu): investigate and fix cache issues. */
            npm.commands.cache(['clean'], function(err) {
              return cb_(err);
            });
          });
        });
      },
      /* Check modules. */
      function(cb_) {
        my.db.find({}, function(err, modules) {
          that.emit('init:list', modules);
          async.each(modules, function(module, cb_) {
            check_module(module, function(err, status) {
              if(err) {
                failed.push(module);
                that.emit('init:failed', module, err);
                return cb_(err);
              }
              if(status === 'missing') {
                missing.push(module);
              }
              else if(status === 'ready') {
                ready.push(module);
              }
              that.emit('init:check', module, status);
              return cb_();
            });
          }, cb_);
        });
      },
      /* Install missing. */
      function(cb_) {
        async.each(missing, function(module, cb_) {
          install_module(module, function(err) {
            if(err) {
              failed.push(module);
              that.emit('init:failed', module, err);
              return cb_(err);
            }
            ready.push(module);
            that.emit('init:install', module);
            return cb_();
          });
        }, cb_);
      },
      /* Start modules. */
      function(cb_) {
        async.each(ready, function(module, cb_) {
          start_module(module, function(err) {
            if(err) {
              failed.push(module);
              that.emit('init:failed', module, err);
              return cb_(err);
            }
            that.emit('init:start', module);
            return cb_();
          });
        }, cb_);
      }
    ], function(err) {
      /* TODO(spolu): spawn a check for updates. This should happen in the */
      /*              background and in series.                            */
      return cb_(err);
    });
  };

  // ### kill
  //
  // Kills the modules manager. It calls the kill procedure on each modules with
  // a timeout before shutting down the module. Once all modules are shutdown it
  // returns the callback.
  // ```
  // @cb_ {function(err)}
  // ```
  kill = function(cb_) {
    var running_modules = [];
    for(var module_id in my.modules) {
      if(my.modules.hasOwnProperty(module_id)) {
        running_modules.push(my.modules[module_id]);
      }
    }
    async.each(running_modules, function(module, cb_) {
      stop_module(module, cb_);
    }, function(err) {
      if(err) {
        return cb_(err);
      }
      common.log.out('All modules stopped.');
      return cb_();
    });
  };

  common.method(that, 'core_expose', core_expose, _super);
  common.method(that, 'core_emit', core_emit, _super);

  common.method(that, 'add_module', add_module, _super);
  common.method(that, 'remove_module', remove_module, _super);

  common.method(that, 'stop_module', stop_module, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.module_manager = module_manager;

