/*
 * Breach: core_controls.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
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
// @spec { core_module, session }
// @inherits {}
// ```
var core_controls = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.core_module = spec.core_module;
  my.session = spec.session;

  /* { id: { frame,      */
  /*         type,       */
  /*         id } }      */
  my.controls = {};

  my.control_cnt = 0;

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
  var control_for_frame;       /* control_for_frame(frame); */

  var frame_keyboard;          /* frame_keyboard(frame, event); */

  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### control_for_frame
  //
  // Retrieves the control associated with the specified frame
  // ```
  // @frame {exo_frame} the frame to search for
  // ```
  control_for_frame = function(frame) {
    for(var type in my.controls) {
      if(my.controls.hasOwnProperty(type) &&
         my.controls[type].frame === frame) {
        return my.controls[type];
      }
    }
    return null;
  };

  /****************************************************************************/
  /* EXOBROWSER EVENTS */
  /****************************************************************************/
  // ### frame_keyboard
  //
  // Called when a keyboard event is sent to any frame in the ExoBrowser. We
  // filter for the frame we recognize and redistribute the event
  // ```
  // @frame {exo_frame} the target frame of the event
  // @event {object} the keyboard evet
  // ```
  frame_keyboard = function(frame, event) {
    var c = control_for_frame(frame);
    if(c) {
      event.frame = {
        id: c.id,
        control_type: c.type,
        type: 'control'
      };
      my.session.module_manager().core_emit('controls:keyboard', event);
    }
  };


  /****************************************************************************/
  /* EXPOSED PROCEDURES */
  /****************************************************************************/
  // ### controls_set
  //
  // Sets a control for the specified control type.
  // Possible control types are: 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'
  // ```
  // @args {object} { type, url, [dimension], [focus] }
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
    if(my.controls[args.type]) {
      return cb_(common.err('Control already set: ' + args.type,
                            'core_controls:control_already_set'));
    }

    var c = {
      frame: api.exo_frame({
        url: args.url,
        session: my.core_module.exo_session()
      }),
      id: common.hash([++my.control_cnt]),
      type: args.type
    };
    my.controls[args.type] = c;


    async.series([
      function(cb_) {
        my.core_module.exo_browser().set_control(api[args.type + '_CONTROL'],
                                                 c.frame, cb_);
      },
      function(cb_) {
        if(args.dimension) {
          my.core_module.exo_browser()
          .set_control_dimension(api[args.type + '_CONTROL'],
                                 args.dimension, 
                                 cb_);
        }
        else {
          return cb_();
        }
      },
      function(cb_) {
        /* TODO(spolu): adapt */
        //push();
        return cb_();
      }
    ], function(err) {
      return cb_(err, { id: c.id });
    });
  };

  // ### controls_unset
  //
  // Unset the control for the specified control type
  // Possible control types are: 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'
  // ```
  // @args {object} { type }
  // @cb_  {function(err, res)}
  // ```
  controls_unset = function(args, cb_) {
    if(!api[args.type + '_CONTROL']) {
      return cb_(common.err('Invalid control type: ' + args.type,
                            'core_controls:invalid_control_type'));
    }
    var c = my.controls[args.type];
    if(!c) {
      return cb_(common.err('Control not set: ' + args.type,
                            'core_controls:control_not_set'));
    }
    async.series([
      function(cb_) {
        delete my.controls[args.type];
        my.core_module.exo_browser().unset_control(c.frame, cb_);
      },
      function(cb_) {
        return c.frame.kill(cb_);
      },
      function(cb_) {
        if(global.gc) global.gc();
        /* TODO(spolu): adapt */
        //push();
        return cb_();
      }
    ], cb_);
  };

  // ### controls_dimension
  //
  // Set the control dimension for the specified control type
  // Possible control types are: 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'
  // ```
  // @args {object} { type, dimension }
  // @cb_  {function(err, res)}
  // ```
  controls_dimension = function(args, cb_) {
    if(!api[args.type + '_CONTROL']) {
      return cb_(common.err('Invalid control type: ' + args.type,
                            'core_controls:invalid_control_type'));
    }
    var c = my.controls[args.type];
    if(!c) {
      return cb_(common.err('Control not set: ' + args.type,
                            'core_controls:control_not_set'));
    }
    async.series([
      function(cb_) {
        my.core_module.exo_browser().set_control_dimension(args.type, 
                                                           args.dimension, 
                                                           cb_);
      },
      function(cb_) {
        /* TODO(spolu): adapt */
        //push();
        return cb_();
      }
    ], cb_);
  };

  // ### controls_focus
  //
  // Focuses the control for the specified control type
  // Possible control types are: 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'
  // ```
  // @args {object} { type }
  // @cb_  {function(err, res)}
  // ```
  controls_focus = function(args, cb_) {
    if(!api[args.type + '_CONTROL']) {
      return cb_(common.err('Invalid control type: ' + args.type,
                            'core_controls:invalid_control_type'));
    }
    var c = my.controls[args.type];
    if(!c) {
      return cb_(common.err('Control not set: ' + args.type,
                            'core_controls:control_not_set'));
    }
    return c.frame.focus(cb_);
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
    my.core_module.exo_browser().on('frame_keyboard', 
                                    frame_keyboard);
    return cb_();
  };

  // ### kill
  //
  // Kills the core controls module and all associated controls
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  kill = function(cb_) {
    async.each(Object.keys(my.controls), function(type, cb_) {
      var c = my.controls[type];
      delete my.controls[type];
      my.core_module.exo_browser().unset_control(c.frame, function(err) {
        if(err) {
          return cb_(err);
        }
        return c.frame.kill(cb_);
      });
    }, cb_);
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
