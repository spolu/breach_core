/*
 * Breach: core_controls.js
 *
 * (c) Copyright Stanislas Polu 2014. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-01-15 spolu   Creation
 */
var common = require('./common.js');
var async = require('async');
var api = require('exo_browser');


// ## core_controls
//
// Breach `core` module controls implementation.
//
// The `core_controls` object is in charge of tracking controls state and 
// exposing the `controls` API to other modules.
//
// ```
// @spec { core_module }
// @inherits {}
// ```
var core_controls = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.core_module = spec.core_module;

  my.controls = {};

  //
  // #### _public_
  //
  var init;                    /* init(cb_); */
  var kill;                    /* kill(cb_); */

  var controls_set;            /* controls_set(args, cb_); */
  var controls_unset;          /* controls_unset(args, cb_); */
  var controls_dimension;      /* controls_dimension(args, cb_); */
  var controls_focus;          /* controls_focus(args, cb_); */

  //
  // #### _private_
  //


  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/


  /****************************************************************************/
  /* EXPOSED PROCEDURES */
  /****************************************************************************/
  // ### controls_set
  //
  // Sets a control for the specified control type.
  // Possible control types are: 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'
  // ```
  // @args {object} { type, url }
  // @cb_  {function(err, res)}
  // ```
  controls_set = function(args, cb_) {
    if(!api[args.type + '_CONTROL']) {
      return cb_(common.err('Invalid control type: ' + args.type,
                            'core_controls:invalid_control_type'));
    }
    if(!args.url) {
      return cb_(common.err('Invalid URL: ' + args.url,
                            'core_controls:invalid_url'));
    }

    var c = {
      frame: api.exo_frame({
        url: args.url,
        session: my.core_module.exo_session()
      }),


  };


  /****************************************************************************/
  /* INITIALIZATION */
  /****************************************************************************/
  // ### init
  // 
  // Initialializes the core controls module
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    return cb_();
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'controls_set', controls_set, _super);
  common.method(that, 'controls_unset', controls_unset, _super);
  common.method(that, 'controls_dimension', controls_dimension, _super);
  common.method(that, 'controls_focus', controls_dimension, _super);

  return that;
};

exports.core_controls = core_controls;
