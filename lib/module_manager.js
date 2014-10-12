/*
 * Breach: module_manager.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-29 spolu   Auto update
 * - 2014-05-27 spolu   Module update
 * - 2014-05-07 spolu   GiG.fs integration
 * - 2014-01-08 spolu   Improved interface
 * - 2013-13-14 spolu   Creation
 */
var async = require('async');
var fs = require('fs-extra');
var child_process = require('child_process');
var https = require('https');
var mkdirp = require('mkdirp');
var events = require('events');
var github = require('octonode');
var npm = require('npm');
var semver = require('semver');
var zlib = require('zlib');
var request = require('request');


var api = require('exo_browser');

var common = require('./common.js');

// ## module_manager
//
// This is the module management class. It exposes methods to init the module
// registry (local for now), search, add, install, remove and start modules.
//
// It also handles the communication between modules (events & RPC) and exposes
// hooks for Breach to expose the `breach/core` module.
//
// A module manager is associated with a session and manages all the running
// modules for that session.
//
// Module IDs are local path or github URLs.
//
// Module description format:
// ```
// {
//   type: 'github'|'local',
//   owner: {author}|'local',
//   name: {name},
//   tag: {tag},
//   path: 'local:...'|'github:...'
//   version: {version},
// }
// ```
//
// API:
// ```
//  add {path}
//  install {path} /* must be added first. */
//  list
//  remove {path}
//  update {path}
//  run_module {path}
//  kill_module {path}
//  ```
//
//
// The module manager handles a dictionary of running module stored in
// `my.running_modules` with the given structure:
// ```
// my.running_modules[module.name] = {
//   process: null,
//   path: path,
//   restart: 0,
//   registrations: [],
//   need_restart: false
// }
// ```
//
// It also handles a dictionary of modules being installed, stored in
// `my.install_modules` with the given structure:
// ```
// my.install_modules[path] = {
//   callbacks: [],
//   path: path
// }
// ```
//
// ```
// @spec { session }
// @emits `state_change`, `update_ready`
// ```
var module_manager = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.UPDATE_FREQUENCY = 1000 * 60 * 60 * 6;
  my.VERSION = require('./../package.json').version;

  my.session = spec.session;
  my.gig = my.session.gig();
  my.github = github.client();

  /* The `modules_path` is the repository of public modules installed on this */
  /* machine. Modules are shared among users of a same machine.               */
  my.modules_path = require('path').join(api.data_path('breach'), 'modules');
  /* The `out_path` is the path at which the modules output is piped. If the */
  /* session is `off_the_record` no such piping is done. */
  my.out_path = my.session.off_the_record() ? null : 
    require('path').join(my.session.data_path(), 'modules.out');
  /* The `gig_path` is the path at which modules are stored on gig */
  my.gig_path = '/sessions/' + my.session.session_id() + '/modules';

  my.running_modules = {};
  my.install_modules = {};

  my.core_module = {
    path: 'internal:breach/core',
    name: 'core',
    procedures: {},
    message_id: 0,
    rpc_calls: {}
  };

  //
  // #### _public_
  // 
  var init;                   /* init(cb_); */
  var kill;                   /* stop(cb_); */

  var core_expose;            /* core_expose(proc, fun); */
  var core_call;              /* core_call(dst, proc, args, cb_); */
  var core_emit;              /* core_emit(type, evt); */

  var add;                    /* add(path, force, cb_) */
  var list;                   /* list(cb_); */
  var install;                /* install(path, cb_); */
  var remove;                 /* remove(path, cb_); */
  var update;                 /* update(path, cb_); */
  var output;                 /* output(path, cb_); */

  var run_module;             /* run_module(path, cb_); */
  var kill_module;            /* kill_module(path, cb_); */

  //
  // #### _private_
  // 
  var gig_module_reducer;     /* gig_module_reducer(oplog); */

  var expand_path;            /* expand_path(path); */
  var augment_path;           /* augment_path(path, cb_); */
  var storage_path;           /* storage_path(path); */

  var dispatch;               /* dispatch(module, msg); */

  var auto_update;            /* auto_update(); */


  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### gig_module_reducer
  //
  // Reducer used with gig to store the `module_manager` state
  // ```
  // @oplog {array} the array of ops to reduce
  // ```
  gig_module_reducer = function(oplog) {
    /* Returns a dictionary of `path` to `module` object. */
    var value = {};
    oplog.forEach(function(op) {
      if(typeof op.value !== 'undefined') {
        value = op.value || {};
      }
      else if(op.payload) {
        switch(op.payload.type) {
          case 'add': {
            var module = op.payload.module;
            Object.keys(value).forEach(function(p) {
              if(value[p].name === module.name) {
                /* If we have a `name` conflict we resolve the conflict by */
                /* keeping the most recent one.                            */
                delete value[p];
              }
            });
            value[module.path] = module;
            break;
          }
          case 'remove': {
            var path = op.payload.path;
            delete value[path];
            break;
          }
          default: {
            break;
          }
        }
      }
    });
    return value;
  };


  // ### expand_path
  //
  // Transforms a path string into a parsed object
  // ```
  // @path {string} a module path
  // ```
  expand_path = function(path) {
    var github_r = 
      /^github\:([a-zA-Z0-9\-_\.]+)\/([a-zA-Z0-9\-_\.]+)(#[a-zA-Z0-9\-_\.]+){0,1}/;
    var github_m = github_r.exec(path);
    if(github_m) {
      return {
        type: 'github',
        owner: github_m[1],
        name: github_m[2],
        tag: github_m[3] ? github_m[3].substr(1) : null,
      }
    }
    var local_r = /^local\:(.+)$/
    var local_m = local_r.exec(path);
    if(local_m) {
      var home_r = /^~/;
      if(home_r.exec(local_m[1])) {
        /* Unix Only */
        return {
          type: 'local',
          path: require('path').join(process.env['HOME'], local_m[1].substr(1))
        }
      }
      return {
        type: 'local',
        path: require('path').normalize(local_m[1])
      };
    }
    return null;
  };

  // ### augment_path
  //
  // Augments a module path. If it's a local path, it checks that it exists and
  // does not do anything. If it's a github path, then it checks that the branch
  // exists. If no branch is specified, it tries to find the most appropriate
  // one
  // ```
  // @path {string} a module path
  // @cb_  {function(err, path)}
  // ```
  augment_path = function(path, cb_) {
    var p = expand_path(path);
    if(!p) {
      return cb_(common.err('Invalid module `path`: ' + path,
                            'module_manager:invalid_path'));
    }
    if(p.type === 'github') {
      var repo = my.github.repo(p.owner + '/' + p.name);
      repo.tags(function(err, data) {
        if(err) {
          return cb_(err);
        }
        var vers = [];
        var match = null;
        data.forEach(function(t) {
          var v = semver.clean(t.name, true);
          if(v) {
            vers.push({
              version: v,
              tag: t.name,
            });
          }
          if(p.tag === t.name) {
            match = {
              version: v,
              tag: t.name
            };
          }
        });
        vers.sort(function(a, b) {
          return semver.gt(b.version, a.version) ? 1 : 
            (semver.lt(b.version, a.version) ? -1 : 0);
        });
        if(match) {
          return cb_(null, path);
        }
        else if(p.tag === 'master') {
          return cb_(null, p.type + ':' + p.owner + '/' + p.name + '#master');
        }
        else if(p.tag) {
          return cb_(common.err('Invalid `path` tag: ' + path,
                                'module_manager:invalid_path'));
        }
        else if(vers.length > 0) {
          return cb_(null,
                     p.type + ':' + p.owner + '/' + p.name + '#' + vers[0].tag);
        }
        else {
          return cb_(null, p.type + ':' + p.owner + '/' + p.name + '#master');
        }
      });
    }
    else if(p.type === 'local') {
      fs.stat(p.path, function(err, stat) {
        if(err) {
          return cb_(err);
        }
        return cb_(null, p.type + ':'  + p.path);
      });
    }
  };

  // ### storage_path
  //
  // Computes the local storage_path for a module given its path
  // ```
  // @path {string} a module path
  // ```
  storage_path = function(path) {
    var p = expand_path(path);
    if(!p) {
      return null;
    }
    switch(p.type) {
      case 'github': {
        return require('path').join(my.modules_path, 
                                    p.owner, p.name + '#' + p.tag);
        break;
      }
      case 'local': {
        return p.path;
        break;
      }
      default: {
        return null;
      }
    }
  };

  // ### auto_update
  //
  // Periodically triggered to auto-update modules.
  auto_update = function() {
    async.waterfall([
      /* Check that the module exists. */
      function(cb_) {
        my.gig.get('core', 'module', my.gig_path, cb_);
      },
      function(modules, cb_) {
        async.eachSeries(Object.keys(modules), function(m, cb_) {
          if(modules[m]) {
            common.log.out('[module_manager] Attempting auto_update of: ' + 
                           modules[m].path);
            /* TODO(spolu): Updating aggressively may leave the module in a */
            /* broken state if the browser is turned of while updating.    */
            update(modules[m].path, cb_);
          }
          else {
            /* The modules object may have been altered by a module update. */
            return cb_();
          }
        }, cb_);
      }
    ], function(err) {
      if(err) {
        common.log.error(err);
      }
    });
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
    if(!msg || !msg.hdr || 
       typeof msg.hdr.typ !== 'string' ||
       typeof msg.hdr.src !== 'string' ||
       typeof msg.hdr.mid !== 'number' ||
       typeof msg.hdr.ver !== 'string' ||
       (!my.running_modules[msg.hdr.src] && 
        msg.hdr.src !== my.core_module.name)) {
      /* We ignore the message. */
      common.log.out('IGNORED: ' + JSON.stringify(msg, null, 2));
      return;
    }

    var msg_str = '[(' + common.rpad(msg.hdr.src, 10) + ') > ' + 
                   '(' + common.rpad(msg.dst || '', 10)  + ')] ' +
                  ' {' + common.rpad(msg.hdr.typ, 10) + '[' + msg.hdr.mid + ']}';
    switch(msg.hdr.typ) {
      case 'register': {
        msg_str +=  ' src:' + common.rpad(msg.src, 10) + ' typ:' + msg.typ;
        break;
      }
      case 'unregister': {
        msg_str +=  ' rid:' + msg.rid;
        break;
      }
      case 'event': {
        msg_str +=  ' typ:' + msg.typ;
        break;
      }
      case 'rpc_call': {
        msg_str +=  ' dst:' + common.rpad(msg.dst, 10) + ' prc:' + msg.prc;
        break;
      }
      case 'rpc_reply': {
        msg_str +=  ' dst:' + common.rpad(msg.dst, 10) + 
                    ' prc:' + common.rpad(msg.prc, 20) + 
                    ' oid:' + msg.oid;
        break;
      }
    }

    if(common.MSG_DUMP) {
      common.log.out('=================================================' +
                     '=================================================');
    }
    if(common.MSG_LOG || common.MSG_DUMP) {
      common.log.out(msg_str);
      if(msg.err) {
        common.log.out('-------------------------------------------------' +
                       '-------------------------------------------------');
        common.log.out('ERROR');
        common.log.out('-------------------------------------------------' +
                       '-------------------------------------------------');
        common.log.out(JSON.stringify(msg.err, null, 2));
        common.log.out('-------------------------------------------------' +
                       '-------------------------------------------------');
      }
    }
    if(common.MSG_DUMP) {
      common.log.out('=================================================' +
                     '=================================================');
      common.log.out(JSON.stringify(msg, null, 2));
      common.log.out('-------------------------------------------------' +
                     '-------------------------------------------------');
    }


    switch(msg.hdr.typ) {
      /* Modules register to each other events with the `register` message    */
      /* type. It creates a registration for the module issuing this message  */
      /* that will get tested against any event emitted. A `registration_id`  */
      /* is created from the `message_id`. Registration `src` and `typ` must  */
      /* string arguments to the RegExp object.                               */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'register', src: 'mod_test', mid: 123, }               */
      /*   src: '.*',                                                         */
      /*   typ: 'state:.*',                                                   */
      /* }                                                                    */
      /* ```                                                                  */
      case 'register': {
        if(typeof msg.src === 'string' && typeof msg.typ === 'string') {
          my.running_modules[msg.hdr.src].registrations.push({
            source: new RegExp(msg.src),
            type: new RegExp(msg.typ),
            registration_id: msg.hdr.mid
          });
        }
        break;
      }
      /* Modules delete created registrations with the `unregister` message   */
      /* type.                                                                */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'register', src: 'mod_test', mid: 137, }               */
      /*   rid: 123                                                           */
      /* }                                                                    */
      /* ```                                                                  */
      case 'unregister': {
        if(typeof msg.rid === 'number') {
          var registrations = my.running_modules[msg.hdr.src].registrations;
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
      /*   hdr: { typ: 'event', src: 'core', mid: 123, }                      */
      /*   typ: 'state:change',                                               */
      /*   evt: { ... }                                                       */
      /* }                                                                    */
      /* ```                                                                  */
      case 'event': {
        Object.keys(my.running_modules).forEach(function(name) {
          my.running_modules[name].registrations.forEach(function(r) {
            if(r.source.test(msg.hdr.src) &&
               r.type.test(msg.typ) &&
               my.running_modules[name].process) {
              try {
                my.running_modules[name].process.send(msg);
              }
              catch(err) {
                common.log.error(err);
              }
            }
          });
        });
        break;
      }
      /* Modules perform remote procedure call by sending messages with the   */
      /* `rpc_call` type. The message is then forwarded to the appropriate    */
      /* module or handled here if it is targeted at the `core` module        */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'rpc_call', src: 'mod_test', mid: 23 },                */
      /*   dst: 'core',                                                       */
      /*   prc: 'new_page',                                                   */
      /*   arg: { ... }                                                       */
      /* }                                                                    */
      /* ```                                                                  */
      case 'rpc_call': {
        var inst_rpc_call = {
          dst: msg.dst,
          src: msg.hdr.src,
          prc: msg.prc 
        };
        /* Instrumentation for stats reporting. */
        setTimeout(function() {
          core_emit('inst:rpc_call', inst_rpc_call);
        });

        /* All modules procedure handling. */
        if(my.running_modules[msg.dst] && 
           (my.running_modules[msg.hdr.src] || 
            msg.hdr.src === my.core_module.name)) {
          if(my.running_modules[msg.dst].process) {
            try {
              my.running_modules[msg.dst].process.send(msg);
            }
            catch(err) {
              common.log.error(err);
            }
          }
          else {
            msg.err = {
              msg: 'Module restarting: `' + msg.dst + '`',
              nme: 'module_restarting'
            };
            setTimeout(function() {
              dispatch(msg)
            });
          }
        }
        /* Core module procedure handling. */
        else if(msg.dst === my.core_module.name) {
          msg.oid = msg.hdr.mid;
          msg.hdr.mid = ++my.core_module.message_id;
          msg.hdr.typ = 'rpc_reply';
          msg.dst = msg.hdr.src;
          msg.hdr.src = my.core_module.name;
          if(my.core_module.procedures[msg.prc]) {
            my.core_module.procedures[msg.prc](msg.dst, msg.arg, 
                                               function(err, res) {
              if(err) {
                msg.err = { msg: err.message, nme: err.name };
              }
              else {
                msg.res = res;
              }
              setTimeout(function() {
                dispatch(msg)
              });
            });
          }
          else {
            msg.err = {
              msg: 'Procedure not found: `' + msg.prc + '`',
              nme: 'procedure_not_found'
            };
            setTimeout(function() {
              dispatch(msg)
            });
          }
        }
        break;
      }
      /* Modules reply to an `rpc_call` message with a `rpc_reply` message    */
      /* type. The message payload is recycled and a `err` or `res` object is */
      /* added to it along with `oid` field (original message id) equal to    */
      /* the `message_id` of the original `rpc_call`.                         */
      /* ```                                                                  */
      /* {                                                                    */
      /*   hdr: { typ: 'rpc_reply', src: 'core', mid: 248 },                  */
      /*   dst: 'mod_test',                                                   */
      /*   prc: 'new_page',                                                   */
      /*   arg: { ... }                                                       */
      /*   oid: 23,                                                           */
      /*   err: { msg: '', nme: '' }                                          */
      /*   res: { ... }                                                       */
      /* }                                                                    */
      /* ```                                                                  */
      case 'rpc_reply': {
        if(my.running_modules[msg.dst] && 
           my.running_modules[msg.dst].process) {
          try {
            my.running_modules[msg.dst].process.send(msg);
          }
          catch(err) {
            common.log.error(err);
          }
        }
        /* Core module procedure reply handling. */
        else if(msg.dst === my.core_module.name) {
          var err = null;
          if(msg.err) {
            err = common.err(msg.err.msg, msg.err.name);
          }
          if(my.core_module.rpc_calls[msg.oid]) {
            my.core_module.rpc_calls[msg.oid](err, msg.res);
            delete my.core_module.rpc_calls[msg.oid];
          }
        }
        break;
      }
    }
  };


  /****************************************************************************/
  /* PUBLIC CORE MODULE METHODS */
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

  // ### core_call
  //
  // Exposes a way for the core module to call rpc methods on modules
  // ```
  // @dst  {string} the destination module name
  // @proc {string} the procedure name
  // @args {object} serializable JSON arguments
  // @cb_  {function(err, res)} the callback when the rpc completes
  // ```
  core_call = function(dst, proc, args, cb_) {
    //console.log('`core_call`: ' + name + ' ' + JSON.stringify(args));
    dispatch({
      hdr: { 
        typ: 'rpc_call', 
        src: my.core_module.name, 
        mid: ++my.core_module.message_id,
        ver: my.VERSION
      },
      dst: dst,
      prc: proc,
      arg: args
    });
    my.core_module.rpc_calls[my.core_module.message_id] = cb_;
  };

  // ### core_emit
  //
  // Emits an event on behalf of the core module
  // ```
  // @type  {string} event type
  // @event {object} serializable object
  // ```
  core_emit = function(type, event) {
    //console.log('`core_emit`: ' + type + ' ' + JSON.stringify(event));
    dispatch({
      hdr: { 
        typ: 'event', 
        src: my.core_module.name, 
        mid: ++my.core_module.message_id,
        ver: my.VERSION
      },
      typ: type,
      evt: event
    });
  };


  /****************************************************************************/
  /* PUBLIC MODULE ACTIONS */
  /****************************************************************************/
  // ### add
  //
  // Adds a module to the module database for this session. Next time the module
  // is run, an attempt to install it will be made. If a module with the same
  // base path (ignoring tags) exists, an error is raised.
  // ```
  // @path  {string} the module path
  // @force {boolean} overrides existing modules (update)
  // @cb_   {function(err, module)}
  // ```
  add = function(path, force, cb_) {
    augment_path(path, function(err, path) {
      if(err) {
        return cb_(err);
      }
      var module = {};
      var package_json = null;
      var version = null;

      async.series([
        /* Check that the module is not already present. */
        function(cb_) {
          my.gig.get('core', 'module', my.gig_path, function(err, modules) {
            if(err) {
              return cb_(err);
            }
            var arr = Object.keys(modules);
            for(var i = 0; i < arr.length; i ++) {
              var m = modules[arr[i]];
              if(!force && 
                 expand_path(m.path).type === expand_path(path).type) {
                if(m.path === path ||
                   (expand_path(path).type === 'github' &&
                    expand_path(m.path).owner === expand_path(path).owner && 
                    expand_path(m.path).name === expand_path(path).name) ||
                   (expand_path(path).type === 'local' &&
                    m.path === path)) {
                  return cb_(common.err('Module conflict: ' + 
                                        path + ' conflicts with ' + m.path,
                                        'module_manager:module_conflict'));
                }
              }
            }
            return cb_();
          });
        },
        /* Retrieves the module package.json. */
        function(cb_) {
          if(expand_path(path).type === 'local') {
            var package_path = require('path').join(expand_path(path).path, 
                                                    'package.json');

            fs.readFile(package_path, function(err, data) {
              if(err) {
                return cb_(err);
              }
              try {
                package_json = JSON.parse(data);
              }
              catch(err) {
                return cb_(err);
              }
              return cb_();
            });
          }
          if(expand_path(path).type === 'github') {
            /* Works with tags AND master */
            var package_url = 'https://raw.github.com/' + 
              expand_path(path).owner + '/' + 
              expand_path(path).name + '/' + 
              expand_path(path).tag + '/package.json';

            var options = {
              url: package_url,
              headers: {
                'User-Agent': 'Mozilla/5.0'
              },
              json: true
            }
            request(options, function(err, res, json) {
              if(err) {
                return cb_(err);
              }
              package_json = json;
              return cb_();
            });
          }
        },
        /* Checks the package.json, retrieve the version, add module. */
        function(cb_) {
          module.path = path;
          module.version = semver.clean(package_json.version, true);
          if(!module.version) {
            return cb_(common.err('Invalid module version `' + module.version + 
                                  '` for module: ' + path,
                                  'module_manager:invalid_version'));
          }
          module.name = package_json.name;
          if(!module.name) {
            return cb_(common.err('Invalid module name `' + module.name + 
                                  '` for module: ' + path,
                                  'module_manager:invalid_name'));
          }

          my.gig.get('core', 'module', my.gig_path, function(err, modules) {
            if(err) {
              return cb_(err);
            }
            var arr = Object.keys(modules);
            for(var i = 0; i < arr.length; i ++) {
              if(!force && modules[arr[i]].name === module.name) {
                return cb_(common.err('Module conflict: ' + module.name + 
                                      ' conflicts with ' + modules[arr[i]].name,
                                      'module_manager:module_conflict'));
              }
            }
            return cb_();
          });
        },
        /* Finally adds the module. */
        function(cb_) {
          my.gig.push('core', 'module', my.gig_path, {
            type: 'add',
            module: module
          }, cb_);
        },
      ], function(err) {
        return cb_(err, module);
      });
    });
  };

  // ### list
  //
  // Lists the modules managed by the module manager for this session and their
  // current status.
  // ```
  // @cb_  {function(err, modules)}
  // ```
  list = function(cb_) {
    my.gig.get('core', 'module', my.gig_path, function(err, modules) {
      if(err) {
        return cb_(err);
      }
      return cb_(null, Object.keys(modules).map(function(p) {
        /* Cloning the object so that the cached value does not get mutated. */
        var out = my.out_path ? 
          require('path').join(my.out_path,
                               modules[p].name + '.out') : null;
        var m = {
          path: modules[p].path,
          version: modules[p].version,
          name: modules[p].name,
          out: out
        };
        if(my.running_modules[m.name]) {
          m.running = true;
          m.need_restart = my.running_modules[m.name].need_restart;
        }
        if(my.install_modules[m.path]) {
          m.installing = true;
          m.install_status = my.install_modules[m.path].status;
        }
        m.type = expand_path(m.path).type;
        m.owner = expand_path(m.path).owner;
        m.tag = expand_path(m.path).tag;
        return m;
      }));
    });
  };

  // ### install
  //
  // Installs a module locally. This function is indempotent and can be called
  // on any module any number of time to verify the module is correctly
  // installed.
  // If the module is not present locally, it will be downloaded and installed.
  // The module path should have been added already as well as the module info
  // is retrieved from the module database by path.
  // ```
  // @path {string} the module path
  // @cb_  {function(err, module)}
  // ```
  install = function(path, cb_) {
    if(my.install_modules[path]) {
      my.install_modules[path].callbacks.push(cb_);
      return;
    }
    else {
      my.install_modules[path] = {
        path: path,
        callbacks: [cb_],
        status: 'init'
      };
    }
    var module = null;
    async.series([
      /* Check that the module exists. */
      function(cb_) {
        my.install_modules[path].status = 'check';
        that.emit('state_change', module);
        my.gig.get('core', 'module', my.gig_path, function(err, modules) {
          if(err) {
            return cb_(err);
          }
          if(!modules[path]) {
            return cb_(common.err('Module unknown: ' + path,
                                  'module_manager:module_unknown'));
          }
          else {
            module = modules[path];
            return cb_();
          }
        });
      },
      /* Installs the module locally. */
      function(cb_) {
        my.install_modules[path].status = 'download';
        that.emit('state_change', module);
        fs.stat(storage_path(path), function(err, stat) {
          if(err && err.code !== 'ENOENT') {
            return cb_(err);
          }
          else if(err && err.code === 'ENOENT') {
            if(expand_path(path).type === 'github') {
              var options = {
                url: 'https://api.github.com' + 
                     '/repos/' + 
                     expand_path(path).owner + '/' + expand_path(path).name + 
                     '/tarball/' + expand_path(path).tag,
                headers: {
                  'User-Agent': 'Mozilla/5.0'
                }
              }
              /* TODO(spolu): move to native `tar xfz` which is way faster? */
              var gzip = zlib.createGunzip();
              var tar = require('tar').Extract({ 
                path: storage_path(path),
                strip: 1
              });
              request(options)
                .pipe(gzip)
                .on('error', function(err) {
                  fs.remove(storage_path(path))
                  return cb_(err);
                })
                .pipe(tar)
                .on('error', function(err) {
                  fs.remove(storage_path(path))
                  return cb_(err);
                })
                .on('end', cb_);
            }
            if(expand_path(path).type === 'local') {
              return cb_(err);
            }
          }
          else {
            return cb_();
          }
        });
      },
      /* Run npm install on the local module. */
      function(cb_) {
        my.install_modules[path].status = 'dependencies';
        that.emit('state_change', module);
        npm.commands.install(storage_path(path), [], function(err, data) {
          if(err) {
            return cb_(err);
          }
          //console.log(data);
          return cb_();
        });
      }
    ], function(err) {
      var i = my.install_modules[path];
      delete my.install_modules[path];

      that.emit('state_change', module);
      i.callbacks.forEach(function(cb_) {
        return cb_(err, module);
      });
    });
  };

  // ### remove
  //
  // Remove the module from the module database and delete it from filesystem.
  // ```
  // @path {string} the module path
  // @cb_  {function(err, module)}
  // ```
  remove = function(path, cb_) {
    var module = null;
    async.series([
      /* Check that the module exists. */
      function(cb_) {
        my.gig.get('core', 'module', my.gig_path, function(err, modules) {
          if(err) {
            return cb_(err);
          }
          if(!modules[path]) {
            return cb_(common.err('Module unknown: ' + path,
                                  'module_manager:module_unknown'));
          }
          else {
            module = modules[path];
            return cb_();
          }
        });
      },
      /* Kill the module. */
      function(cb_) {
        if(my.running_modules[module.name]) {
          kill_module(module.path, cb_);
        }
        else {
          return cb_();
        }
      },
      /* Remove the module from the module db. */
      function(cb_) {
        my.gig.push('core', 'module', my.gig_path, {
          type: 'remove',
          path: path
        }, cb_);
      },
      /* Remove the module from filesystem if not local. */
      function(cb_) {
        if(expand_path(path).type === 'github') {
          fs.remove(storage_path(path), cb_)
        }
        if(expand_path(path).type === 'local') {
          return cb_();
        }
      }
    ], function(err) {
      return cb_(err, module);
    });
  };

  // ### update
  //
  // Attempts to update a module.
  //
  // - If the module is local, the update action has no effect.
  // - If the module is tracking the tag #master, the update action will destroy
  // the local copy of the module and download the most recent #master version.
  // - If the module is tracking a tag, it will attempt to retrieve the new tag
  // and install the files locally to finally update the module information to
  // point the new tag. If no new tag is available, then the update action has
  // no effect.
  //
  // The update action can be performed on a running or stopped module. The path
  // provided must be a fully explicited (tag) path of an existing module.
  //
  // If the update action had any effect and an old version module is running,
  // it's `need_restart` flag is set to true.
  // ```
  // @path {string} the module path
  // @cb_  {function(err, module)}
  // ```
  update = function(path, cb_) {
    var module = null;
    var need_restart = false;
    async.series([
      /* Check that the module exists. */
      function(cb_) {
        my.gig.get('core', 'module', my.gig_path, function(err, modules) {
          if(err) {
            return cb_(err);
          }
          if(!modules[path]) {
            return cb_(common.err('Module unknown: ' + path,
                                  'module_manager:module_unknown'));
          }
          else {
            module = modules[path];
            return cb_();
          }
        });
      },
      /* Retrieves the module package.json. */
      function(cb_) {
        if(expand_path(path).type === 'local') {
          return cb_();
        }
        if(expand_path(path).type === 'github') {
          augment_path(path.split('#')[0], function(err, p) {
            if(err) {
              return cb_(err);
            }
            else if(expand_path(path).tag !== expand_path(p).tag) {
              common.log.out('[module_manager] Updating ' + path + ' to ' + p);
              path = p;
              add(path, true, cb_);
            }
            else if(expand_path(path).tag === 'master') {
              common.log.out('[module_manager] Updating ' + path);
              fs.remove(storage_path(path), cb_)
            }
            else {
              return cb_();
            }
          });
        }
      },
      /* We run the final install. */
      function(cb_) {
        install(path, cb_);
      },
      /* We check the new version of the module. */
      function(cb_) {
        my.gig.get('core', 'module', my.gig_path, function(err, modules) {
          if(err) {
            return cb_(err);
          }
          if(!modules[path]) {
            return cb_(common.err('Module unknown: ' + path,
                                  'module_manager:module_unknown'));
          }
          else {
            if(module.version !== modules[path].version) {
              need_restart = true;
            }
            module = modules[path];
            return cb_();
          }
        });
      },
      /* We finally mark updated running modules as need_restart. */
      function(cb_) {
        if(my.running_modules[module.name]) {
          my.running_modules[module.name].need_restart =
            my.running_modules[module.name].need_restart || need_restart;
        }
        if(need_restart) {
          common.log.out('[module_manager] Update ready for ' + 
                         module.path + ' [' + module.version + ']');
          that.emit('update_ready', module);
        }
        return cb_();
      }
    ], function(err) {
      return cb_(err, module);
    });
  };

  // ### output
  //
  // Retrieves the module output
  // ```
  // @path {string} the module path
  // @cb_  {function(err, module)}
  // ```
  output = function(path, cb_) {
    var module = null;
    async.waterfall([
      /* Check that the module exists. */
      function(cb_) {
        my.gig.get('core', 'module', my.gig_path, function(err, modules) {
          if(err) {
            return cb_(err);
          }
          if(!modules[path]) {
            return cb_(common.err('Module unknown: ' + path,
                                  'module_manager:module_unknown'));
          }
          else {
            module = modules[path];
            return cb_();
          }
        });
      },
      function(cb_) {
        var out = my.out_path ? 
          require('path').join(my.out_path,
                               module.name + '.out') : null;
        if(!out) {
          return cb_(common.err('Impossible to retrieve `out_path`',
                                'module_manager:no_out_path'));
        }
        fs.readFile(out, function(err, data) {
          return cb_(err, data.toString());
        });
      }
    ], cb_);
  };

  /****************************************************************************/
  /* PUBLIC RUN/KILL MODULE */
  /****************************************************************************/
  // ### run_module
  //
  // Attempts to locally install the module and run it. It sets up all the hooks
  // required by a running module and calls the exposed `init` method on the
  // newly created process.
  // ```
  // @path {string} the module path
  // @cb_  {function(err, module)}
  // ```
  run_module = function(path, cb_) {
    var module = null;
    async.series([
      /* Check that the module exists. */
      function(cb_) {
        my.gig.get('core', 'module', my.gig_path, function(err, modules) {
          if(err) {
            return cb_(err);
          }
          if(!modules[path]) {
            return cb_(common.err('Module unknown: ' + path,
                                  'module_manager:module_unknown'));
          }
          else {
            module = modules[path];
            return cb_();
          }
        });
      },
      function(cb_) {
        if(my.running_modules[module.name] &&
           my.running_modules[module.name].process) {
          return cb_(common.err('Module already running: ' + path,
                                'module_manager:module_running'));
        }
        return cb_();
      },
      /* Install the module (indempotent). */
      function(cb_) {
        install(path, cb_);
      },
      /* Finally run the module. */
      function(cb_) {
        common.log.out('[module_manager] `run_module`: ' + 
                       module.name + ' [' + path + ']');
        my.running_modules[module.name] = my.running_modules[module.name] || {
          process: null,
          name: module.name,
          path: path,
          restart: 0,
          registrations: [],
          need_restart: false
        };

        var args = ['--no-chrome'];
        if(common.DEBUG) args.push('--debug');

        var p = child_process.fork(storage_path(path), args, { 
          silent: !my.session.off_the_record()
        });
        if(my.out_path) {
          var s_path = require('path').join(my.out_path, module.name + '.out');
          var s = fs.createWriteStream(s_path, { 
            flags: (my.running_modules[module.name].restart === 0 ? 'w' : 'a')
          });
          p.stdout.pipe(s);
          p.stderr.pipe(s);
        }
        my.running_modules[module.name].process = p;

        p.on('exit', function(code) {
          /* For now all modules are supposed to be longlived. So any module */
          /* exiting is treated as an error and the module is restarted.     */
          common.log.out('[module_manager] Module exited unexpectedly: ' + 
                         path);
          p.removeAllListeners();
          delete my.running_modules[module.name].process;

          if(my.running_modules[module.name].restart < 3) {
            common.log.out('[module_manager] Restarting: ' + module.name);
            my.running_modules[module.name].restart++;
            run_module(path, function(err) {
              if(err) {
                common.log.error(err);
              }
            });
          }
          else {
            /* After 3 restarts we stop restarting the module. */
            delete my.running_modules[module.name];
          }
        });

        p.on('message', function(msg) {
          if(msg && msg.hdr && 
             msg.hdr.typ === 'event' &&
             msg.typ === 'internal:ready') {
            dispatch({
              hdr: { 
                typ: 'rpc_call', 
                src: my.core_module.name, 
                mid: ++my.core_module.message_id,
                ver: my.VERSION
              },
              dst: module.name,
              prc: 'init'
            });
          }
          else if(msg && msg.hdr && 
                  typeof msg.hdr.typ === 'string' &&
                  typeof msg.hdr.mid === 'number') {
            msg.hdr.src = module.name;
            dispatch(msg);
          }
          /* Otherwise we ignore the message. */
        });

        return cb_();
      }
    ], function(err) {
      that.emit('state_change', module);
      return cb_(err, module);
    });
  };

  // ### kill_module
  //
  // Stops a module by calling its `kill` method (with timeout) and finally
  // shutting down its process.
  // ```
  // @path {string} the module path
  // @cb_  {function(err, module)}
  // ```
  kill_module = function(path, cb_) {
    var module = null;
    async.series([
      /* Check that the module exists. */
      function(cb_) {
        my.gig.get('core', 'module', my.gig_path, function(err, modules) {
          if(err) {
            return cb_(err);
          }
          if(!modules[path]) {
            return cb_(common.err('Module unknown: ' + path,
                                  'module_manager:module_unknown'));
          }
          else {
            module = modules[path];
            return cb_();
          }
        });
      },
      /* Kill. */
      function(cb_) {
        /* The order of events here is quite important as while we are        */
        /* killing a module it must still be able to communicate (clean up    */
        /* controls as an example) so he must remind in the `running_modules` */
        /* object but once he's done and has exited he must not be restarted. */
        /* We therefore replace the exit listener and install a timeout       */
        /* before sending a final `kill` rpc as the core module.              */

        if(my.running_modules[module.name]) {
          /* We send the final `kill` rpc call but do not listen for the      */
          /* response as the only proper response is fore the module to exit. */
          core_call(module.name, 'kill', null, function(err) {
            if(err) {
              common.log.error(err);
            }
          });

          /* We replace the `exit` listener so that the module does not get */
          /* restarted automatically once it exits.                         */
          my.running_modules[module.name].process.removeAllListeners('exit');

          /* A timeout is setup to kill the module if it failed to exit on */
          /* its own in the next 5s.                                       */
          var itv = setTimeout(function() {
            if(my.running_modules[module.name]) {
              common.log.out('[module_manager] Module forced kill: ' + 
                             module.name);
              my.running_modules[module.name].process.kill();
            }
          }, 5 * 1000);

          common.log.out('[module_manager] sending kill: ' + module.name);
          my.running_modules[module.name].process.on('exit', function() {
            common.log.out('[module_manager] Module exited after ' + 
                           '`kill_module`: ' + module.name);
            my.running_modules[module.name].process.removeAllListeners();
            delete my.running_modules[module.name];
            clearTimeout(itv);
            return cb_();
          });
        }
        else {
          return cb_();
        }
      }
    ], function(err) {
      that.emit('state_change', module);
      return cb_(err, module);
    });
  };


  /****************************************************************************/
  /* INIT / KILL */
  /****************************************************************************/
  // ### init
  //
  // Inits the module manager. Modules are not started, and should be started by
  // the session.
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    var missing = [];
    var ready = [];
    var failed = [];
    
    async.series([
      /* Initialization. */
      function(cb_) {
        my.gig.register('module', gig_module_reducer);
        return cb_();
      },
      function(cb_) {
        mkdirp(my.modules_path, function(err) {
          if(err) { 
            return cb_(err);
          }
          return npm.load({
            cache: require('path').join(my.modules_path, 'extract', 'npm_cache')
          }, cb_);
        });
      },
      function(cb_) {
        if(my.out_path) {
          mkdirp(my.out_path, cb_);
        }
        else {
          return cb_();
        }
      },
      function(cb_) {
        if(!process.env['BREACH_NO_AUTO_UPDATE']) {
          setTimeout(auto_update, 1000 * 60 * 5);
          setInterval(auto_update, my.UPDATE_FREQUENCY);
        }
        return cb_();
      }
    ], function(err) {
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
    async.each(Object.keys(my.running_modules), function(name, cb_) {
      kill_module(my.running_modules[name].path, cb_);
    }, function(err) {
      if(err) {
        return cb_(err);
      }
      common.log.out('[module_manager] All modules stopped.');
      return cb_();
    });
  };

  common.method(that, 'core_expose', core_expose, _super);
  common.method(that, 'core_call', core_call, _super);
  common.method(that, 'core_emit', core_emit, _super);

  common.method(that, 'add', add, _super);
  common.method(that, 'list', list, _super); 
  common.method(that, 'install', install, _super);
  common.method(that, 'remove', remove, _super);
  common.method(that, 'update', update, _super);
  common.method(that, 'output', output, _super);

  common.method(that, 'run_module', run_module, _super);
  common.method(that, 'kill_module', kill_module, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.getter(that, 'out_path', my, 'out_path');

  return that;
};

exports.module_manager = module_manager;

