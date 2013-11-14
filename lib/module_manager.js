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
var mkdirp = require('mkdirp');
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
// The startup process is as follows:
// - Initialization of the module manager
// - Checking if all modules are installed locally
// - Install missing modules
// - Start modules
// - Asynchronoulsy check for updates
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

  //
  // #### _public_
  // 
  var init;  /* init(cb_); */
  var kill;  /* stop(cb_); */

  var check_modules;   /* check_modules(cb_); */
  var install_module;  /* install_module(module, cb_); */
  var start_module;    /* start_module(module, cb_); */
  var update_module;   /* update_module(module, cb_); */


  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* HELPERS */
  /****************************************************************************/

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### init
  //
  // Inits the module manager 
  init = function(cb_) {
    async.series([
      function(cb_) {
        mkdirp(my.modules_path, cb_);
      },
      function(cb_) {
        my.db = factory.db(my.session_data_path);
      }
    ], cb_);
  };

  // ### kill
  //
  // Kills the modules manager. Performs all the necessary actions before
  // shutdown.
  kill = function(cb_) {
  };


  common.method(that, 'kill', kill, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.module_manager = module_manager;

