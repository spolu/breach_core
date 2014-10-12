/*
 * Breach: core_controls.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-01-15 spolu  Creation
 */
"use strict"

var http = require('http');

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
  var install_context_menu;    /* install_context_menu(type); */

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

  // ### install_context_menu
  //
  // Installs the context menu handler for a given control
  // ```
  // @type  {string}    the control type
  // @id    {string}    the frame id
  // ```
  install_context_menu = function(type, id) {
    if(!my.controls[type]) {
      return;
    }
    my.controls[type].frame.set_context_menu_handler(function(params, cb_) {
      var final = [
        { item: 'Reload',
          trigger: function() {
            if(my.controls[type]) {
              my.controls[type].frame.reload(function(err) {
                if(err) {
                  common.log.error(err);
                }
              });
            }
        } },
        { item: null },
        { item: 'Inspect Element',
          trigger: function() {
            if(my.controls[type]) {
              async.parallel({
                url: function(cb_) {
                  my.core_module.exo_session().get_dev_tools_url(function(url) {
                    return cb_(null, url);
                  });
                },
                id: function(cb_) {
                  my.controls[type].frame.dev_tools_get_id(function(id) {
                    return cb_(null, id);
                  });
                },
                element_at: function(cb_) {
                  my.controls[type].frame.dev_tools_inspect_element_at(params.x,
                                                                       params.y, cb_);
                }
              }, function(err, res) {
                var dev_id = res.id;
                var url_p = require('url').parse(res.url);
                var json_url = 'http://' + url_p.hostname + ':' + url_p.port +
                '/json/list';
                http.get(json_url, function(res) {
                  res.setEncoding('utf8');
                  var data = '';
                  res.on('data', function(chunk) {
                    data += chunk;
                  });
                  res.on('end', function() {
                    try {
                      JSON.parse(data).forEach(function(dev) {
                        if(dev.id === dev_id) {
                          var url = 'http://' + url_p.hostname + ':' + url_p.port +
                          dev.devtoolsFrontendUrl;
                          common.log.out('[control] DEVTOOLS: ' + url);
                          my.session.module_manager().core_emit('devtools', 
                                                                { devtools_url: url });
                        }
                      });
                    }
                    catch(err) { /* NOP */ }
                  });
                }).on('error', function(err) { /* NOP */ });
              });
            }
        } },
        { item: 'Close DevTools',
          trigger: function() {
            my.session.module_manager().core_emit('devtools', 
                                                  { devtools_url: null });
        } }
      ];
      return cb_(null, final);
    });
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
  // @event {object} the keyboard event
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
  // @src  {string} source module
  // @args {object} { type, url, [dimension], [focus] }
  // @cb_  {function(err, res)}
  // ```
  controls_set = function(src, args, cb_) {
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
    install_context_menu(args.type);

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
        if(args.focus) {
          c.frame.focus();
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
  // @src  {string} source module
  // @args {object} { type }
  // @cb_  {function(err, res)}
  // ```
  controls_unset = function(src, args, cb_) {
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
        my.core_module.exo_browser().unset_control(api[args.type + '_CONTROL'], 
                                                   cb_);
      },
      function(cb_) {
        return c.frame.kill(cb_);
      },
      function(cb_) {
        if(global.gc) global.gc();
        return cb_();
      }
    ], cb_);
  };

  // ### controls_dimension
  //
  // Set the control dimension for the specified control type
  // Possible control types are: 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'
  // ```
  // @src  {string} source module
  // @args {object} { type, dimension, focus }
  // @cb_  {function(err, res)}
  // ```
  controls_dimension = function(src, args, cb_) {
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
        my.core_module.exo_browser()
          .set_control_dimension(api[args.type + '_CONTROL'], 
                                 args.dimension, 
                                 cb_);
      },
      function(cb_) {
        if(args.focus) {
          return c.frame.focus(cb_);
        }
        else {
          return cb_();
        }
      }
    ], cb_);
  };

  // ### controls_focus
  //
  // Focuses the control for the specified control type
  // Possible control types are: 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'
  // ```
  // @src  {string} source module
  // @args {object} { type }
  // @cb_  {function(err, res)}
  // ```
  controls_focus = function(src, args, cb_) {
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
  // Initializes the core controls module
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
      my.core_module.exo_browser().unset_control(api[type + '_CONTROL'], 
                                                 function(err) {
        if(err) {
          /* We ignore the error as the browser may have already been */
          /* killed when we get here.                                 */
          common.log.error(err);
        }
        return c.frame.kill(function(err) {
          if(err) {
            /* We ignore the error as the frames may have already been */
            /* killed when we get here.                                */
            common.log.error(err);
          }
          return cb_();
        });
      });
    }, function(err) {
      if(global.gc) global.gc();
      return cb_(err);
    });
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'controls_set', controls_set, _super);
  common.method(that, 'controls_unset', controls_unset, _super);
  common.method(that, 'controls_dimension', controls_dimension, _super);
  common.method(that, 'controls_focus', controls_focus, _super);

  return that;
};

exports.core_controls = core_controls;
