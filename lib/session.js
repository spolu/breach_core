/*
 * Breach: session.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-01-17 spolu   New Init/RunModules API
 * 2013-11-14 spolu   FMA refactoring
 * 2013-10-21 spolu   Cookie Store integration for v0.1
 * 2013-09-05 spolu   Fix #56
 * 2013-08-12 spolu   Creation
 */
var events = require('events');
var async = require('async');
var path = require('path');
var mkdirp = require('mkdirp');

var api = require('exo_browser');

var common = require('./common.js');

// ## session
//
// ```
// @spec { session_id, off_the_record }
// ```
var session = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.session_id = spec.session_id || 'NO_SESSION_ID';

  my.off_the_record = spec.off_the_record || false;
  my.data_path = my.off_the_record ? null : 
    path.join(api.data_path('breach'), 'sessions', my.session_id);

  my.core_module = null;
  my.module_manager = null;

  //
  // #### _public_
  //
  var init;          /* init(cb_); */
  var run_modules;   /* run_modules(cb_); */
  var kill;          /* kill(cb_); */

  //
  // #### _private_
  //

  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### init
  // 
  // Initialializes this session
  // ```
  // @cb_ {function(err, session)} asynchronous callback
  // ```
  init = function(cb_) {
    async.series([
      function(cb_) {
        if(!my.off_the_record) {
          mkdirp(my.data_path, cb_);
        }
        else {
          return cb_();
        }
      },
      function(cb_) {
        my.module_manager = require('./module_manager.js').module_manager({
          session: that
        });
        my.module_manager.init(cb_);
      }
    ], function(err) {
      return cb_(err, that);
    });
  };

  // ### run_modules
  // 
  // Starts the core_module and all installed modules
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  run_modules = function(cb_) {
    async.series([
      function(cb_) {
        my.core_module = require('./core_module.js').core_module({
          session: that
        });
        my.core_module.init(cb_);
      },
      function(cb_) {
        /*
        my.module_manager.stop_module({
          module_id: 'breach/mod_test',
          version: '0.0.2'
        }, function(err) {
          console.log('DONE');
        });
        */
        /*
        my.module_manager.add('local:~/src/breach/mod_test', function(err, module) {
          if(err) {
            common.log.error(err);
          }
          else {
            common.log.out('>>>> INTSALL DONE');
            common.log.out(JSON.stringify(module));
          }
        });
        */
        my.module_manager.list(function(err, modules) {
          if(err) {
            common.log.error(err);
          }
          console.log(JSON.stringify(modules, null, 2));
        });
        my.module_manager.run_module('local:/home/spolu/src/breach/mod_test', function(err) {
          if(err) {
            common.log.error(err);
          }
          console.log('DONE RUNNING');
        });
        /*
        my.module_manager.remove('github:breach/mod_test#v0.0.3', function(err) {
          if(err) {
            common.log.error(err);
          }
          console.log('DONE REMOVE');
        });
        */
      }
    ], cb_);
  };

  // ### kill
  //
  // Kills this session as well as the underlying exo_browser
  kill = function() {
    /* TODO(spolu) */
  };

  
  common.method(that, 'init', init, _super);
  common.method(that, 'run_modules', run_modules, _super);
  common.method(that, 'kill', kill, _super);

  common.getter(that, 'off_the_record', my, 'off_the_record');
  common.getter(that, 'data_path', my, 'data_path');
  common.getter(that, 'session_id', my, 'session_id');

  common.getter(that, 'module_manager', my, 'module_manager');

  return that;
};

exports.session = session;
