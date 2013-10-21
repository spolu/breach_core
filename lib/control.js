/*
 * ExoBrowser: control.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-12 spolu   Creation
 */

var events = require('events');
var common = require('./common.js');
var factory = common.factory;
var api = require('exo_browser');

// ### control
//
// A control is a base class for all controls. It is in charge of setting up
// a frame and proceeding to a handshake with its client code (throught
// socket.io).
//
// A control has a frame and a socket associated with it.
//
// Only after the handshake is done should the control should the init
// callback be returned.
// ```
// spec { session, type, control_type }
// ```
var control = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {}; 

  my.session = spec.session;
  my.type = spec.type || 'no_type';
  my.name = my.session.exo_browser().name() + '_' + my.type;
  my.control_type = spec.control_type;

  my.frame = null;
  my.socket = null;

  //
  // #### _public_
  // 
  var init;         /* init(cb_); */
  var kill;         /* kill(); */
  var handshake;    /* handshake(socket); */

  var show;         /* show(); */
  var hide;         /* hide(); */
  var focus;        /* focus([cb_]); */
  var visible;      /* visible(); */
  var toggle;       /* toggle([visible]); */

  //
  // ### _protected_
  //
  var dimension;    /* dimension(); */

  //
  // #### that
  //
  var that = new events.EventEmitter();

  //
  // ### dimension
  //
  // Returns the desired canonical dimension
  //
  dimension = function() {
    /* Default Value */
    return 100;
  };

  // ### show
  //
  // Makes the stack visible (and focus on it?)
  show = function() {
    my.session.exo_browser().set_control_dimension(my.control_type, 
                                                   that.dimension());
  };

  // ### hide
  //
  // Hides the stack
  hide = function() {
    my.session.exo_browser().set_control_dimension(my.control_type, 0);
  };

  // ### focus
  //
  // Focuses the control frame
  // ```
  // @cb_ {function()} optional callback
  focus = function(cb_) {
    return my.frame.focus(cb_);
  };


  // ### visible
  //
  // Forward to underlying frame `visible` which already handles the logic of
  // computing the visibility
  visible = function() {
    return my.frame.visible();
  };

  // ### toggle
  //
  // If no argument is provided it just toggles the stack visibility. If a
  // visibility argument is provided, it shows or hides it.
  // ```
  // @visible {boolean} toggle to this visibility
  // ```
  toggle = function(visible) {
    if(typeof visible === 'boolean') {
      if(visible) {
        that.show();
      }
      else {
        that.hide();
      }
    }
    else {
      if(that.visible()) {
        that.hide();
      }
      else {
        that.show();
      }
    }
  };

  // ### init
  // 
  // This init method should be overriden by the control implementation which
  // should finish by calling its parent method (this one)
  // ```
  // @cb_ {function(err)} callack
  // ```
  init = function(cb_) {
    var url = my.session.base_url() + '/' + my.type + 
      '/#/?session=' + my.session.name()
    my.frame = api.exo_frame({
      name: my.name,
      url: url
    });
    my.session.exo_browser().set_control(my.control_type, my.frame);
    my.init_cb_ = cb_;
  };

  // ### kill
  //
  // Called when everything should be cleanedup. All underlying native objects
  // have already been killed and are waiting to get reclaimed.
  kill = function() {
    my.socket.disconnect();
    my.frame.kill();
  };

  // ### handshake
  //
  // Receives the socket.io socket on handshake
  // ```
  // @socket {socket.io socket}
  // ```
  handshake = function(socket) {
    my.socket = socket;
    factory.log().out('HANDSHAKE: ' + my.name);
    if(my.init_cb_) {
      var cb_ = my.init_cb_;
      /* We make sure to call init_cb_ only once as multuple handshakes could */
      /* happen (reload for dev) */
      delete my.init_cb_;
      return cb_();
    }
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);
  common.method(that, 'handshake', handshake, _super);

  common.method(that, 'show', show, _super);
  common.method(that, 'hide', hide, _super);
  common.method(that, 'focus', focus, _super);
  common.method(that, 'visible', visible, _super);
  common.method(that, 'toggle', toggle, _super);

  common.getter(that, 'frame', my, 'frame');

  return that;
};

exports.control = control;

