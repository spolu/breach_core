/*
 * Breach: core.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-12-07 spolu   Creation
 */
var common = require('./common.js');

// ## core
//
// Breach `core` module implementation.
//
// The `core` module exposes Breach API to other modules and maintain the
// navigation state. Navigation state must be maintained by the `core` module
// (opened, displayed tabs, displayed controllers) as the associated JS objects
// (exo_frames, exo_browsers) must live in this process.
//
// The core module also manages the different `exo_session`s created by the 
// other modules and their associations to `exo_browser` widows.
//
// ```
// @spec {}
// @inherits {}
// ```
var core = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  //
  // #### _public_
  //
  var init;          /* init(cb_); */
  var kill;          /* kill(cb_); */

  //
  // #### _private_
  //
  
  //
  // #### _that_
  //
  var that = {};

  // ### init
  // 
  // Initialializes the core module
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
  };
};

exports.core = core;
