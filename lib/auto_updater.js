/*
 * Breach: auto_updater.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-14 spolu   Creation
 */
"use strict"

var events = require('events');
var async = require('async');
var api = require('exo_browser');

var common = require('./common.js');

// ## auto_updater
//
// The auto_updater is in charge of auto-updating Breach if possible (writable)
// or notify of a new version availability otherwise.
//
// The auto_updater is executed in the background it will:
// - if BREACH_AUTO_UPDATE env is defined
//   - Download last.breach.cc (JSON)
//   - Compare it with the currently hardcoded version
//   - if a newer version exists
//     - if current executable path is writable
//       - download and extract in /tmp/breach.auto_update
//       - replace files (specificities on OSX / Linux)
//       - emit `update_ready`
//     - if current executable path is not writable
//       - emit `update_available`
//
// The auto_updater expects Bundles on OSX and a certain directory structure 
// around the native executable on Linux. This directory structure must be
// checked an recognized for the update to happen.
//
// This is not a perfect solution on Linux as we have small control on where
// Breach is installed with which permissions. We run the update there only
// if we feel confident it will work.
//
// ```
// @spec { }
// ```
var auto_updater = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.VERSION = '0.3-alpha.0';

  //
  // _public_
  //
  var init;                /* init(cb_); */

  //
  // _private_
  //
  var check_update;        /* check_last(); */
  var sanity_linux;        /* sanity_linux; */
  var sanity_osx;          /* sanity_linux; */
  var install_update;      /* install_update(cb_); */

  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### init
  // 
  // Initialializes the auto_updater and starts checking for updates 
  // periodically
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    console.log(require('path').resolve(__dirname));
    if(cb_) return cb_();
  };

  common.method(that, 'init', init, _super);

  return that;
};

exports.auto_updater = auto_updater;
