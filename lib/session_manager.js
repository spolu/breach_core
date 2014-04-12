/*
 * Breach: session_manager.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-04-11 spolu   Creation
 */
"use strict"

var events = require('events');
var async = require('async');

var common = require('./common.js');

// ## session_manager
//
// ```
// @spec { }
// ```
var session_manager = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  //
  // _public_
  //
  var init;      /* init(cb_); */
  var kill;      /* kill(cb_); */

  //
  // _private_
  //

  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.session_manager = session_manager;

