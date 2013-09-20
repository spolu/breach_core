/*
 * ExoBrowser: stack.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-12 spolu   Creation
 * 2013-09-02 spolu   Fix #45 Focus on new Tab
 * 2013-09-06 spolu   Fix #60 Recover page
 */

var common = require('./common.js');
var factory = common.factory;
var api = require('./api.js');

// ### stack
//
// ```
// @spec { session }
// ```
var stack = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  /* [{ frame,       */
  /*    state,       */
  /*    box_value }] */
  my.pages = [];
  my.recover = [];
  my.pinned = 0;
  my.active = 0;
  my.visible = true;
  my.favicons = {}
  my.filter = null;
  my.last_active_page = null;

  //
  // ### _public_
  //
  var init;         /* init(cb_); */
  var handshake;    /* handshake(); */

  var new_page;     /* new_page([url]); */
  var active_page;  /* active_page(); */

  var filter_start; /* filter_start(re); */
  var filter_stop;  /* filter_stop(); */

  //
  // ### _private_
  //
  var page_for_frame;           /* page_for_frame(frame); */
  var page_for_frame_name;      /* page_for_frame_name(frame); */
  var filter_page;              /* filter_page(page, [re]); */
  var clear_filter;             /* clear_filter(); */
  var push;                     /* push(); */
  var insert_page;              /* insert_page(page, [background], [cb_]); */

  var frame_navigation_state;   /* frame_navigation_state(frame, state); */
  var frame_favicon_update;     /* frame_favicon_update(frame, favicons); */
  var browser_frame_created;    /* browser_frame_created(frame, disp, origin); */
  var browser_open_url;         /* browser_open_url(frame, disp, origin); */

  var socket_select_page;       /* socket_select_page(name); */
  var socket_toggle_pin;        /* socket_toggle_pin(name); */

  var shortcut_new_page;        /* shortcut_new_page(); */
  var shortcut_stack_toggle;    /* shortcut_stack_toggle(); */
  var shortcut_stack_next;      /* shortcut_stack_next(); */
  var shortcut_stack_prev;      /* shortcut_stack_prev(); */
  var shortcut_stack_close;     /* shortcut_stack_close(); */
  var shortcut_stack_pin;       /* shortcut_stack_pin(); */
  var shortcut_recover_page;    /* shortcut_recover_page(); */
  
  //
  // ### _protected_
  //
  var dimension;    /* dimension(); */
  var toggle;       /* toggle(visible); */

  //
  // #### _that_
  //
  var that = require('./control.js').control({
    session: spec.session,
    type: 'stack',
    control_type: api.LEFT_CONTROL
  }, my);

  /****************************************************************************/
  /*                            CONTROL INTERFACE                             */
  /****************************************************************************/
  // ### dimension
  //  
  // Returns the desired canonical dimension
  dimension = function() {
    return 250;
  };

  // ### toggle
  //
  // Overrides the _super toggle method
  toggle = function(visible) {
    if(typeof visible !== 'undefined') {
      my.visible = visible;
    }
    else {
      my.visible = !my.visible;
    }
    _super.toggle(my.visible);
    that.emit('visible', my.visible);
  };


  // ### handshake
  //
  // Receives the socket and sets up events
  // ```
  // @socket {socket.io socket}
  // ```
  handshake = function(socket) {
    _super.handshake(socket);

    my.socket.on('select_page', socket_select_page);
    my.socket.on('toggle_pin', socket_toggle_pin);

    new_page();
  };

  // ### init
  // 
  // Initialization (asynchronous) [see control.js]. Also sets up the event
  // handlers on the exo_browser events
  // ```
  // @cb_ {function(err)} callack
  // ```
  init = function(cb_) {
    _super.init(cb_);

    my.session.exo_browser().on('frame_navigation_state', 
                                frame_navigation_state);
    my.session.exo_browser().on('frame_favicon_update', 
                                frame_favicon_update);
    my.session.exo_browser().on('frame_created', 
                                browser_frame_created);
    my.session.exo_browser().on('open_url', 
                                browser_open_url);

    my.session.keyboard_shortcuts().on('new_page', 
                                       shortcut_new_page);
    my.session.keyboard_shortcuts().on('stack_toggle', 
                                       shortcut_stack_toggle);
    my.session.keyboard_shortcuts().on('stack_next', 
                                       shortcut_stack_next);
    my.session.keyboard_shortcuts().on('stack_prev', 
                                       shortcut_stack_prev);
    my.session.keyboard_shortcuts().on('stack_commit', 
                                       shortcut_stack_commit);
    my.session.keyboard_shortcuts().on('stack_close', 
                                       shortcut_stack_close);
    my.session.keyboard_shortcuts().on('stack_pin', 
                                       shortcut_stack_pin);
    my.session.keyboard_shortcuts().on('recover_page', 
                                       shortcut_recover_page);
  };

  /****************************************************************************/
  /*                             PRIVATE HELPERS                              */
  /****************************************************************************/
  // ### page_for_frame
  //
  // Retrieves the page associated with this frame if it exists within this
  // stack or null otherwise
  // ```
  // @frame {exo_frame} the frame to search for
  // ```
  page_for_frame = function(frame) {
    for(var i = 0; i < my.pages.length; i ++) {
      if(my.pages[i].frame === frame)
        return my.pages[i];
    }
    return null;
  };

  // ### page_for_frame_name
  //
  // Retrieves the page associated with this frame_name if it exists within 
  // this stack or null otherwise
  // ```
  // @frame {exo_frame} the frame to search for
  // ```
  page_for_frame_name = function(name) {
    for(var i = 0; i < my.pages.length; i ++) {
      if(my.pages[i].frame.name() === name)
        return my.pages[i];
    }
    return null;
  };

  // ### filter_page
  //
  // Returns true or false if a page pass the current filter or the specified
  // one if specified
  // ```
  // @page {object} a page
  // @re   {RegExp} a regular expression
  filter_page = function(page, re) {
    re = re || my.filter;
    var add = re ? false : true;
    if(re && page.state.entries.length > 0) {
      var n = page.state.entries[page.state.entries.length - 1];
      add = add || re.test(n.url.href);
      add = add || re.test(n.title);
      console.log('FILTER PAGE: ' + n.title + ' ' + add);
    }
    return add;
  };

  // ### clear_filter
  //
  // Clears the filter and emits an event to notify whoever is interestd (box).
  // This private method does not push as caller probably already does it.
  clear_filter = function() {
    my.filter = null;
    that.emit('clear_filter');
  };

  // ### push
  //
  // Pushes the entries to the control ui for update
  push = function() {
    var update = [];
    my.pages.forEach(function(p, i) {
      if(filter_page(p)) {
        update.push({ 
          name: p.frame.name(), 
          state: p.state, 
          pinned: p.pinned,
          active: i === my.active
        })
      }
    });
    if(my.socket) {
      my.socket.emit('pages', update);
    }
    if(my.pages.length > 0) {
      if(my.last_active_page !== my.pages[my.active] && !my.filter) {
        that.emit('active_page', my.pages[my.active]);
        my.last_active_page = my.pages[my.active];
      }
    }
  };

  // ### insert_page
  //
  // Insert a new page within the stack, respecting the passed disposition
  // ```
  // @page       {object} page objcet
  // @background {boolean} should be inserted in the background
  // @cb_        {function()} callback
  // ```
  insert_page = function(page, background, cb_) {
    /* If we're pinned, we create the page at the end of the pinned pages. */
    /* Otherwise, we create it above the current page if foreground and    */
    /* underneath it if background.                                        */
    var insert = -1;
    if(my.pages[my.active] && my.pages[my.active].pinned) {
      insert = my.pinned;
    } 
    else {
      insert = !background ? my.active : my.active + 1;
    }
    my.pages.splice(insert, 0, page);
    my.active = !background ? insert : my.active;

    my.session.exo_browser().add_page(page.frame, function() {
      if(!background) {
        my.session.exo_browser().show_page(page.frame, function() {
          if(cb_) return cb_();
        });
      }
      else {
        if(cb_) return cb_();
      }
    });
  };
  

  /****************************************************************************/
  /*                            EXOBROWSER EVENTS                             */
  /****************************************************************************/
  // ### frame_navigation_state
  //
  // An update has been made to the navigation state, so we should update our
  // own internal state
  // ```
  // @frame {exo_frame} the target_frame
  // @state {object} the navigation state
  // ```
  frame_navigation_state = function(frame, state) {
    var p = page_for_frame(frame);
    if(p) {
      /* We clear the box_value for this page only if the state visible entry */
      /* `id` has changed (we navigated somewhere)                            */
      var new_id = null, old_id = null;
      var new_href = null, old_href = null;
      p.state.entries.forEach(function(n) { 
        if(n.visible) {
          old_id = n.id; 
          old_href = n.url.href;
        }
      });
      state.entries.forEach(function(n) { 
        if(n.visible) {
          new_id = n.id; 
          new_href = n.url.href;
        }
      });
      
      p.state = state;
      p.state.entries.forEach(function(n) {
        if(my.favicons[n.id]) {
          n.favicon = my.favicons[n.id];
        }
      });
      push();

      if(new_id !== old_id && new_id !== null) {
        p.box_value = null;
        that.emit('navigation_state', true);
      }
      else if(new_href !== old_href && new_href != null) {
        that.emit('navigation_state', false);
      }
    }
  };

  // ### frame_favicon_update
  //
  // We receive the favicon (and not use the `navigation_state` because of:
  // CRBUG 277069) and attempt to stitch it in the correct state entry
  // ```
  // @frame    {exo_frame} the target frame
  // @favicons {array} array of candidates favicon urls
  // ```
  frame_favicon_update = function(frame, favicons) {
    /* TODO(spolu): for now we take the first one always. Add the type into */
    /* the API so that a better logic can be implemented here.              */
    var p = page_for_frame(frame);
    if(favicons.length > 0 && p) {
      p.state.entries.forEach(function(n) {
        if(n.visible) {
          my.favicons[n.id] = favicons[0];
          n.favicon = favicons[0];
        }
      });
      push();
    }
  }; 

  // ### browser_frame_created
  //
  // Received when a new frame was created. We'll handle the disposition 
  // `new_background_tab` and `new_foreground_tab` and will ignore the other
  // ones that should be handled by the session.
  // ```
  // @frame       {exo_frame} the newly created frame
  // @disposition {string} the disposition for opening that frame
  // @initial_pos {array} initial rect
  // @origin      {exo_frame} origin exo_frame
  // ```
  browser_frame_created = function(frame, disposition, initial_pos, origin) {
    if(disposition !== 'new_foreground_tab' &&
       disposition !== 'new_background_tab') {
      return;
    }

    var p = {
      frame: frame,
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      },
      box_value: null
    };

    insert_page(p, disposition === 'new_background_tab', function() {
      p.frame.focus();
    });
    push();
  };

  // ### browser_open_url
  //
  // Event received when a new URL should be opened by the session. Depending on
  // the disposition we'll ignore it (handled by the stack) or we'll create a
  // new exo_browser to handle the detached popup
  // ```
  // @url         {string} the URL to open
  // @disposition {string} the disposition for opening that frame
  // @origin      {exo_frame} origin exo_frame
  // ```
  browser_open_url = function(url, disposition, origin) {
    if(disposition !== 'new_foreground_tab' &&
       disposition !== 'new_background_tab' &&
       disposition !== 'current_tab') {
      return;
    }

    if(disposition === 'current_tab') {
      that.active_page().frame.load_url(url);
      return;
    }

    var p = {
      frame: api.exo_frame({
        url: url
      }),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      },
      box_value: null 
    };

    insert_page(p, disposition === 'new_background_tab', function() {
      p.frame.focus();
    });
    push();
  };

  /****************************************************************************/
  /*                          SOCKET EVENT HANDLERS                           */
  /****************************************************************************/
  // ### socket_select_page
  //
  // Received when an page is selected from the UI
  // ```
  // @name {string} the frame name of the page
  // ```
  socket_select_page = function(name) {
    for(var i = 0; i < my.pages.length; i ++) {
      if(my.pages[i].frame.name() === name) {
        var p = my.pages.splice(i, 1)[0];
        if(!p.pinned) {
          my.pages.splice(my.pinned, 0, p);
          my.active = my.pinned;
        }
        else {
          my.pages.splice(my.pinned - 1, 0, p);
          my.active = my.pinned - 1;
        }
        push();
        my.session.exo_browser().show_page(my.pages[my.active].frame, 
                                           function() {
          my.pages[my.active].frame.focus();
        });
        break;
      }
    }
  };

  // ### socket_toggle_pin
  //
  // Received when an page pinned state need to be toggled
  // ```
  // @name {string} the frame name of the page
  // ```
  socket_toggle_pin = function(name) {
    for(var i = 0; i < my.pages.length; i ++) {
      if(my.pages[i].frame.name() === name) {
        var p = my.pages.splice(i, 1)[0]
        if(!p.pinned) {
          p.pinned = true;
          /* We set active to pinned then we increment pinned */
          my.active = my.pinned++;
          my.pages.splice(my.active, 0, p);
        }
        else {
          p.pinned = false;
          /* We decrement then we set active to pinned */
          my.active = --my.pinned;
          my.pages.splice(my.active, 0, p);
        }
        push();
        my.session.exo_browser().show_page(my.pages[my.active].frame, 
                                           function() {
          my.pages[my.active].frame.focus();
        });
        break;
      }
    }
  };

  /****************************************************************************/
  /*                      KEYBOARD SHORTCUT EVENT HANDLERS                    */
  /****************************************************************************/
  // ### shortcut_new_page
  //
  // Keyboard shorcut to create a new page
  shortcut_new_page = function() {
    that.new_page();
  };

  // ### shortcut_stack_toggle
  //
  // Keyboard shorcut to toggle the stack visibility
  // ```
  // @visible {boolean} direction
  // ```
  shortcut_stack_toggle = function(visible) {
    that.toggle(visible);
  };

  // ### shortcut_stack_next
  //
  // Keyboard shorcut to view next page
  shortcut_stack_next = function() {
    if(!my.visible)
      _super.toggle(true);
    for(var i = my.active + 1; i < my.pages.length; i ++) {
      if(filter_page(my.pages[i])) {
        break;
      }
    }
    if(i < my.pages.length) {
      my.active = i;
      my.session.exo_browser().show_page(my.pages[my.active].frame, function() {
        my.pages[my.active].frame.focus();
      });
      push();
    }
  };

  // ### shortcut_stack_prev
  //
  // Keyboard shorcut to view previous page
  shortcut_stack_prev = function() {
    if(!my.visible)
      _super.toggle(true);
    for(var i = my.active - 1; i >= 0; i--) {
      if(filter_page(my.pages[i])) {
        break;
      }
    }
    if(i >= 0) {
      my.active = i;
      my.session.exo_browser().show_page(my.pages[my.active].frame, function() {
        my.pages[my.active].frame.focus();
      });
      push();
    }
  };

  // ### shortcut_stack_commit
  //
  // Keyboard shortcut to commit page change
  shortcut_stack_commit = function() {
    if(!my.visible)
      _super.toggle(false);
    clear_filter();
    if(!my.pages[my.active].pinned) {
      var p = my.pages.splice(my.active, 1)[0];
      my.pages.splice(my.pinned, 0, p);
      my.active = my.pinned;
    }
    else {
      /* If we're pinned we implement the reverse stack order and put the */
      /* page at the end of the pinned section.                           */
      var p = my.pages.splice(my.active, 1)[0];
      my.pages.splice(my.pinned - 1, 0, p);
      my.active = my.pinned - 1;
    }
    my.session.exo_browser().show_page(my.pages[my.active].frame, function() {
      my.pages[my.active].frame.focus();
    });
    push();
  };

  // ### shortcut_stack_close
  //
  // Keyboard shorcut to close current page
  shortcut_stack_close = function() {
    var p = my.pages.splice(my.active, 1)[0]
    
    /* Push the current url to the set of recoverable URLs. */
    if(p.state.entries[p.state.entries.length - 1].url) {
      my.recover.push(p.state.entries[p.state.entries.length - 1].url.href);
    }

    my.session.exo_browser().remove_page(p.frame, function() {
      p.frame.kill();
      if(p.pinned) my.pinned--;
      if(my.active === my.pages.length) my.active--;
      if(global.gc) global.gc();
      if(my.pages.length === 0) {
        my.session.kill();
      }
      else {
        my.session.exo_browser().show_page(my.pages[my.active].frame, 
                                           function() {
          my.pages[my.active].frame.focus();
        });
        push();
      }
    });
  };

  // ### shortcut_stack_pin
  //
  // Keyboard shorcut to pin the current page
  shortcut_stack_pin = function() {
    var p = my.pages.splice(my.active, 1)[0]
    if(!p.pinned) {
      p.pinned = true;
      /* We set active to pinned then we increment pinned */
      my.active = my.pinned++;
      my.pages.splice(my.active, 0, p);
    }
    else {
      p.pinned = false;
      /* We decrement then we set active to pinned */
      my.active = --my.pinned;
      my.pages.splice(my.active, 0, p);
    }
    push();
  };

  // ### shortcut_recover_page
  //
  // Keyboard shortcut to recover a closed page
  shortcut_recover_page = function() {
    /* TODO(spolu): For now we just recover the URL and not the history. */
    if(my.recover.length) {
      var url = my.recover.pop();
      that.new_page(url);
    }
  };


  /****************************************************************************/
  /*                              PUBLIC METHODS                              */
  /****************************************************************************/
  // ### new_page
  //
  // Creates a new page for the provided url or a default one if not specified.
  // The url is supposed to be a valid url. There's nothing smart here.
  // ```
  // @url        {string} the url to navigate to
  // ```
  //
  new_page = function(url) {
    clear_filter();
    var box_focus = !url ? true : false;
    url = url || (my.session.base_url() + '/home.html');

    var p = {
      frame: api.exo_frame({
        url: url
      }),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      },
      box_value: null 
    };

    insert_page(p, false, function() {
      var loading_hdlr = function(frame) {
        if(frame === p.frame) {
          if(!box_focus) {
            p.frame.focus();
          }
          else {
            my.session.box().focus();
          }
        }
        else {
          my.session.exo_browser().once('frame_loading_stop', 
                                        loading_hdlr);
        }
      };
      loading_hdlr(null);
    });
    push();
  };

  // ### active_page
  //
  // Returns the current actrive page
  active_page = function() {
    if(my.pages.length > 0) {
      return my.pages[my.active]
    }
    return null;
  };

  // ### filter_start
  //
  // Start a filer phase (Stack is shown and pages are filtered by the regexp
  // passed on their title or url)
  filter_start = function(re) {
    my.filter = re;
    if(!my.visible) {
      _super.toggle(true);
    }
    push();
  };

  // ### filter_stop
  //
  // Stops the filter phase (Stack is restored to its state with no filter)
  // ```
  // @navigate {boolean} navigate to the first filtered result if it exists
  // ```
  filter_stop = function(navigate) {
    if(!my.visible)
      _super.toggle(false);

    if(navigate) {
      for(var i = 0; i < my.pages.length; i ++) {
        if(filter_page(my.pages[i])) {
          var p = my.pages.splice(i, 1)[0];
          if(!p.pinned) {
            my.pages.splice(my.pinned, 0, p);
            my.active = my.pinned;
          }
          else {
            my.pages.splice(my.pinned - 1, 0, p);
            my.active = my.pinned - 1;
          }
          break;
        }
      }
    }
    my.session.exo_browser().show_page(my.pages[my.active].frame, function() {
      my.pages[my.active].frame.focus();
    });
    my.filter = null;
    push();
  };

  

  common.method(that, 'init', init, _super);
  common.method(that, 'handshake', handshake, _super);
  common.method(that, 'dimension', dimension, _super);
  common.method(that, 'toggle', toggle, _super);

  common.method(that, 'new_page', new_page, _super);
  common.method(that, 'active_page', active_page, _super);

  common.method(that, 'filter_start', filter_start, _super);
  common.method(that, 'filter_stop', filter_stop, _super);
  
  return that;
};

exports.stack = stack;
