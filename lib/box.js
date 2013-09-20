/*
 * ExoBrowser: box.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-16 spolu   Creation
 */

var common = require('./common.js');
var factory = common.factory;
var api = require('./api.js');

//
// ### box
//
// ```
// @spec { session }
// ```
//
var box = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.MODE_NORMAL = 1 << 0;
  my.MODE_FIND_IN_PAGE = 1 << 1;
  my.MODE_SEARCH_TABS = 1 << 2;
  my.MODE_COMMAND = 1 << 3;

  my.state = {
    value: '',
    can_go_back: false,
    can_go_forward: false,
    stack_visible: true,
    mode: my.MODE_NORMAL
  };

  //
  // ### _public_
  //
  var init;           /* init(cb_); */
  var handshake;      /* handshake(); */

  //
  // ### _private_
  //
  var push;                    /* push(); */

  var stack_active_page;       /* stack_active_page(page); */
  var stack_visible;           /* stack_visible(visible); */
  var stack_clear_filter;      /* stack_clear_filter(); */
  var stack_navigation_state;  /* stack_navigation_state(); */

  var socket_box_input;        /* socket_box_input(input); */
  var socket_box_input_submit; /* socket_box_input_submit(input); */
  var socket_box_input_out;    /* socket_box_input_out(); */

  var socket_box_back;         /* socket_box_back(); */
  var socket_box_forward;      /* socket_box_forward(); */
  var socket_box_stack_toggle; /* socket_box_stack_toggle(); */

  var shortcut_go;             /* shortcut_go(); */
  var shortcut_back;           /* shortcut_back(); */
  var shortcut_forward;        /* shortcut_forward(); */
  var shortcut_reload;         /* shortcut_reload(); */
  var shortcut_find_in_page;   /* shortcut_find_in_page(); */

  
  //
  // ### _protected_
  //
  var dimension;  /* dimension(); */

  //
  // #### _that_
  //
  var that = require('./control.js').control({
    session: spec.session,
    type: 'box',
    control_type: api.TOP_CONTROL
  }, my);

  /****************************************************************************/
  /*                            CONTROL INTERFACE                             */
  /****************************************************************************/
  // ### dimension
  //  
  // Returns the desired canonical dimension
  dimension = function() {
    return 35;
  };

  // ### handshake
  //
  // Receives the socket and sets up events
  // ```
  // @socket {socket.io socket}
  // ```
  handshake = function(socket) {
    _super.handshake(socket);

    my.socket.on('box_input', socket_box_input);
    my.socket.on('box_input_submit', socket_box_input_submit);
    my.socket.on('box_input_out', socket_box_input_out);

    my.socket.on('box_back', socket_box_back);
    my.socket.on('box_forward', socket_box_forward);
    my.socket.on('stack_toggle', socket_box_stack_toggle);

    push();
  };

  // ### init
  // 
  // Initialization (asynchronous) [see control.js]. Also sets up the event
  // handlers on the stack control.
  // ```
  // @cb_ {function(err)} callack
  // ```
  init = function(cb_) {
    _super.init(cb_);

    my.session.stack().on('active_page', stack_active_page);
    my.session.stack().on('visible', stack_visible);
    my.session.stack().on('clear_filter', stack_clear_filter);
    my.session.stack().on('navigation_state', stack_navigation_state);

    my.session.keyboard_shortcuts().on('go', shortcut_go);
    my.session.keyboard_shortcuts().on('back', shortcut_back);
    my.session.keyboard_shortcuts().on('forward', shortcut_forward);
    my.session.keyboard_shortcuts().on('reload', shortcut_reload);
    my.session.keyboard_shortcuts().on('find_in_page', shortcut_find_in_page);
  };

  /****************************************************************************/
  /*                             PRIVATE HELPERS                              */
  /****************************************************************************/
  // ### push
  //
  // Pushes the current active page url to the control UI for eventual update 
  // (The url might not get directly updated if it is being edited, etc)
  push = function() {
    if(my.socket) {
      my.socket.emit('state', my.state);
    }
  };

  // ### computed_value
  //
  // Computes the value that the box should have given the current state
  computed_value = function() {
    var page = my.session.stack().active_page();
    var value = '';
    if(page) {
      page.state.entries.forEach(function(n) {
        if(n.visible) {
          var home_url_r = /^http:\/\/127\.0\.0\.1\:[0-9]+\/home\.html$/;
          if(home_url_r.test(n.url.href)) {
            value = '';
          }
          else {
            value = n.url.href;
          }
        }
      });
      if(page.box_value)
        value = page.box_value;
    }
    return value;
  };

  /****************************************************************************/
  /*                             STACK EVENTS                                 */
  /****************************************************************************/
  // ### stack_active_page
  //
  // Received from the stack whenever the active page is updated as it can
  // potentially impact the url to display. Sent if page has changed.
  // ```
  // @page {object} the current active page
  // ```
  stack_active_page = function(page) {
    my.state.can_go_back = page.state.can_go_back;
    my.state.can_go_forward = page.state.can_go_forward;
    my.state.mode = my.MODE_NORMAL;
    my.state.value = computed_value();
    page.frame.find_stop('clear');
    push();
  };

  // ### stack_visible
  //
  // Received from the stack whenever the stack visibility is toggled
  // ```
  // @visible {boolean} whether the stack is visible
  // ```
  stack_visible = function(visible) {
    my.state.stack_visible = visible;
    push();
  };

  // ### stack_clear_filter
  //
  // Received when the the filter has been cleared by the stack
  stack_clear_filter = function() {
    my.box_value = null;
    my.state.value = computed_value();
    my.state.mode = my.MODE_NORMAL;
    push();
  };

  // ### stack_navigation_state
  //
  // Received when the navigation_state was updated (url change, box_value
  // cleared, new page entry)
  // ```
  // @clear {boolean} whether the box should be cleared
  // ```
  stack_navigation_state = function(clear) {
    my.state.value = computed_value();
    if(clear) {
      my.state.mode = my.MODE_NORMAL;
    }
    var page = my.session.stack().active_page();
    if(page) {
      my.state.can_go_back = page.state.can_go_back;
      my.state.can_go_forward = page.state.can_go_forward;
    }
    push();
  };

  /****************************************************************************/
  /*                          SOCKET EVENT HANDLERS                           */
  /****************************************************************************/
  // ### socket_box_input
  //
  // Received when the user types into the box
  // ```
  // @input {string} the box input string
  // ```
  socket_box_input = function(input) {
    var page = my.session.stack().active_page();
    if(page) {
      switch(my.state.mode) {
        case my.MODE_FIND_IN_PAGE: {
          page.frame.find(input, true, false, false);
          my.box_value = input;
          break;
        }
        case my.MODE_SEARCH_TABS: {
          my.session.stack().filter_start(new RegExp(input.substr(1), 'i'));
          my.box_value = input;
          if(input.length === 0) {
            my.state.mode = my.MODE_NORMAL;
            my.session.stack().filter_stop();
          }
          break;
        }
        case my.MODE_COMMAND:
        case my.MODE_NORMAL:
        default: {
          my.box_value = input;
          if(input.length === 1 && input[0] === '/') {
            my.state.mode = my.MODE_SEARCH_TABS;
            my.session.stack().filter_start(new RegExp());
          }
          if(input.length === 1 && input[0] === ':') {
            my.state.mode = my.MODE_COMMAND;
          }
        }
      }
    }
  };
  
  // ### socket_box_input_submit
  //
  // Received whenever the box input is submitted by the user. We operate an 
  // heuristic here, if we detect that it is an url, we sanitize it and navigate
  // to it.
  //
  // Otherwise, we perform a google search
  // ```
  // @data {object} with `input` and `is_ctrl`
  // ```
  socket_box_input_submit = function(data) {
    var page = my.session.stack().active_page();
    if(page) {
      switch(my.state.mode) {
        case my.MODE_FIND_IN_PAGE: {
          if(!data.is_ctrl) {
            page.frame.find(my.box_value, true, false, true);
          }
          else {
            page.frame.find_stop('activate');
            my.state.mode = my.MODE_NORMAL;
            my.box_value = null;
            my.state.value = computed_value();
            push();
          }
          break;
        }
        case my.MODE_SEARCH_TABS: {
          my.session.stack().filter_stop(true);
          my.box_value = null;
          my.state.value = computed_value();
          my.state.mode = my.MODE_NORMAL;
          push();
          break;
        }
        case my.MODE_COMMAND: {
          /* TODO(spolu) execute command */
          console.log('EXECUTE: ' + my.box_value.substr(1));
          my.box_value = null;
          my.state.value = computed_value();
          my.state.mode = my.MODE_NORMAL;
          push();
          break;
        }
        case my.MODE_NORMAL:
        default: {
          var url_r = /^(http(s{0,1})\:\/\/){0,1}[a-z0-9\-\.]+(\.[a-z0-9]{2,4})+/;
          var ip_r = /^(http(s{0,1})\:\/\/){0,1}[0-9]{1,3}(\.[0-9]{1,3}){3}/
          var localhost_r = /^(http(s{0,1})\:\/\/){0,1}localhost+/
          var host_r = /^http(s{0,1})\:\/\/[a-z0-9\-\.]+/
          var http_r = /^http(s{0,1})\:\/\//;
          if(url_r.test(data.value) || 
             ip_r.test(data.value) || 
             localhost_r.test(data.value) || 
             host_r.test(data.value)) {
            if(!http_r.test(data.value)) {
              data.value = 'http://' + data.value;
            }
            page.frame.load_url(data.value);
          }
          else {
            var search_url = 'https://www.google.com/search?' +
            'q=' + escape(data.value) + '&' +
              'ie=UTF-8';
            page.frame.load_url(search_url);
          }
          my.state.mode = my.MODE_NORMAL;
          my.state.value = computed_value();
          push();
          break;
        }
      }
    }
  };

  // ### socket_box_input_out
  //
  // Event triggered when the focus of the input box has been lost.
  socket_box_input_out = function() {
    var page = my.session.stack().active_page();
    if(page) {
      switch(my.state.mode) {
        case my.MODE_FIND_IN_PAGE: {
          my.state.mode = my.MODE_NORMAL;
          my.box_value = null;
          my.state.value = computed_value();
          page.frame.find_stop('clear');
          push();
          break;
        }
        case my.MODE_SEARCH_TABS:
        case my.MODE_NORMAL:
        default: {
          my.state.mode = my.MODE_NORMAL;
          my.box_value = null;
          my.state.value = computed_value();
          push();
          break;
        }
      }
    }
    /* Finally we refocus the page as the focus should not be on the box */
    /* anymore.                                                          */
    page.frame.focus();
  };

  // ### socket_box_back
  //
  // Received when the back button is clicked
  socket_box_back = function() {
    var page = my.session.stack().active_page();
    if(page) {
      page.frame.go_back_or_forward(-1);
    }
  };

  // ### socket_box_forward
  //
  // Received when the back button is clicked
  socket_box_forward = function() {
    var page = my.session.stack().active_page();
    if(page) {
      page.frame.go_back_or_forward(1);
    }
  };

  // ### socket_box_stack_toggle
  //
  // Received when the stack toggle button is clicked
  socket_box_stack_toggle = function() {
    my.session.stack().toggle();
  };

  /****************************************************************************/
  /*                      KEYBOARD SHORTCUT EVENT HANDLERS                    */
  /****************************************************************************/
  // ### shortcut_go
  //
  // Keyboard shorcut to create focus on box and select all text
  shortcut_go = function() {
    that.focus();
    if(my.socket) {
      my.socket.emit('select_all');
    }
  };

  // ### shortcut_back
  //
  // Keyboard shorcut for the back button
  shortcut_back = function() {
    var page = my.session.stack().active_page();
    if(page) {
      page.frame.go_back_or_forward(-1);
    }
  };
  // ### shortcut_forward
  //
  // Keyboard shorcut for the forward button
  shortcut_forward = function() {
    var page = my.session.stack().active_page();
    if(page) {
      page.frame.go_back_or_forward(1);
    }
  };

  // ### shortcut_reload
  //
  // Keyboard shortuct to reload the page
  shortcut_reload = function() {
    var page = my.session.stack().active_page();
    if(page) {
      page.frame.reload();
    }
  };

  // ### shortcut_find_in_page
  //
  // Keyboard shortcut to find in page
  shortcut_find_in_page = function() {
    var page = my.session.stack().active_page();
    if(page) {
      page.frame.find_stop('clear');
    }
    my.state.mode = my.MODE_FIND_IN_PAGE;
    my.state.box_value = '';
    that.focus(function() {
      push();
      if(my.socket) {
        my.socket.emit('select_all');
      }
    });
  };


  /****************************************************************************/
  /*                              PUBLIC METHODS                              */
  /****************************************************************************/

  common.method(that, 'init', init, _super);
  common.method(that, 'handshake', handshake, _super);
  common.method(that, 'dimension', dimension, _super);

  return that;
};

exports.box = box;

