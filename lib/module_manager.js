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
var api = require('exo_browser');
var async = require('async');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var events = require('events');
var common = require('./common.js');
var factory = common.factory;

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
//
// Module description format:
// ```
// {
//   module_id: 'breach/stack',
//   version: '0.1.2',
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

  my.modules = {};

  my.CORE_MODULE = 'core/breach';
  my.core_procs = {};
  my.core_mid = 0;

  //
  // #### _public_
  // 
  var init;            /* init(cb_); */
  var kill;            /* stop(cb_); */

  var core_expose;     /* core_expose(proc, fun); */
  var core_emit;       /* core_emit(type, evt); */

  //
  // #### _private_
  // 
  var module_path;     /* module_path(module); */

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
    return path.join(my.modules_path, module.module_id + '@' + module.version);
  };

  /****************************************************************************/
  /* MODULE ACTIONS */
  /****************************************************************************/
  // ### check_module
  //
  // Checks the presence in the module in the local module directory and returns
  // a status value.
  // ```
  // @module {object} a module description object
  // @cb_    {function(err, status)}
  // ```
  check_module = function(module, cb_) {
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
  // Clones a module in the local module directory and performs an npm install
  // on it.
  // ```
  // @module {object} a module description object
  // @cb_    {function(err, status)}
  // ```
  install_module = function(module, cb_) {
    /* TODO(spolu): implement the retrieval through GitHub + npm install */
    return cb_(null, 'ready');
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
    my.modules[module.module_id] = my.modules[module.module_id] || {
      process: null,
      module: module,
      restart: 0
    };

    var p = child_process.fork(module_path(module), []);

    my.modules[module.module_id].process = p;

    p.on('exit', function() {
      if(my.modules[module.module_id].restart < 3) {
        my.modules[module.module_id].restart++;
        start_module(my.modules[module.module_id].module, function() {});
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
    return cb_();
  };

  /****************************************************************************/
  /* MESSAGE DISPATCH */
  /****************************************************************************/
  // ### dispatch
  //
  // Dispatches a message received from a module to where it is supposed to go
  // There are three types of messages: 
  // `event`      : event emitted by modules and dipsatched to registered modules
  // `register`   : registers for some events
  // `unregister` : unregisters an existing registration
  // `rpc_call`   : remote procedure call directed to a module
  // `rpc_reply`  : reply from a remote procedure call
  //
  // Inter-process messages have the following format:
  // ```
  // {
  //   hdr: { typ: 'event', src: 'breach/core', mid: 123, }
  //   typ: 'state:change',
  //   evt: { ... }
  // }
  // {
  //   hdr: { typ: 'register', src: 'breach/core', mid: 123, }
  //   src: 'breach\/.*',
  //   typ: 'state:.*',
  //   rid: 39
  // }
  // {
  //   hdr: { typ: 'register', src: 'breach/core', mid: 123, }
  //   rid: 39
  // }
  // {
  //   hdr: { typ: 'rpc_call', src: 'spolu/test', mid: 23 },
  //   dst: 'breach/core',
  //   prc: 'new_page',
  //   arg: { ... }
  // }
  // {
  //   hdr: { typ: 'rpc_reply', src: 'breach/core', mid: 24 },
  //   src: 'spolu/test',
  //   dst: 'breach/core',
  //   prc: 'new_page',
  //   oid: 23,
  //   arg: { ... }
  //   err: { msg: '', nme: '' }
  //   res: { ... }
  // }
  // ```
  dispatch = function(msg) {
    if(!msg || !msg.hdr || 
       typeof msg.hdr.typ !== 'string' ||
       typeof msg.hdr.mid !== 'number' ||
       typeof msg.hdr.src !== 'string') {
      /* We ignore the message. */
      return;
    }
       
    switch(msg.hdr.typ) {
      case 'register': {
        break;
      }
      case 'unregister': {
        break;
      }
      case 'event': {
        break;
      }
      case 'rpc_call': {
        msg.src = msg.hdr.src;
        /* Core module procedure handling. */
        if(msg.dst === my.CORE_MODULE) {
          msg.oid = msg.hdr.mid;
          msg.hdr.src = my.CORE_MODULE;
          msg.hdr.mid = ++my.core_mid;
          if(my.core_procs[msg.prc]) {
            my.core_procs[msg.prc](msg.arg, function(err, res) {
              if(err) {
                msg.err = {
                  msg: err.message,
                  nme: err.name
                };
              }
              else {
                msg.re s= res;
              }
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
        }
        /* All modules procedure handling. */
        else if(my.modules[msg.dst] && my.modules[msg.hdr.src]) {
          my.modules[msg.dst].process.send(msg);
        }
        break;
      }
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
    my.core_procs[proc] = fun;
  };

  // ### core_emit
  //
  // Emits an event on behalf of the core module
  // ```
  // @type  {string} event type
  // @event {object} serializable object
  // ```
  core_emit = function(type, event) {
    dispatch({
      hdr: { typ: 'event', src: my.CORE_MODULE, mid: ++my.core_mid },
      typ: type,
      evt: event
    });
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
          my.db = factory.db(my.session_data_path);
          return cb_();
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
          install_module(module, function(err, status) {
            if(err) {
              failed.push(module);
              that.emit('init:failed', module, err);
              return cb_(err);
            }
            if(status === 'ready') {
              ready.push(module);
            }
            that.emit('init:install', module, status);
            return cb_();
          });
        });
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
        });
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
  };


  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.module_manager = module_manager;

