/*
 * Breach: core_tabs.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-01-13 spolu   Creation
 */
var common = require('./common.js');
var async = require('async');
var api = require('exo_browser');

// ## core_module
//
// Breach `core` module tabs implementation.
//
// The `core_tabs` object is in charge of tracking tabs state and exposing the 
// `tabs` API to other modules.
//
// ```
// @spec { core_module, session }
// @inherits {}
// ```
var core_tabs = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.core_module = spec.core_module;
  my.session = spec.session;

  /* { id: { frame,      */
  /*         id,         */
  /*         state,      */
  /*         loading } } */
  my.tabs = {};
  my.favicons = {};
  my.visible = null;
  my.frame_cnt = 0;

  //
  // #### _public_
  //
  var init;                    /* init(cb_); */
  var kill;                    /* kill(cb_); */

  var tabs_new;                /* tabs_new(args, cb_); */
  var tabs_close;              /* tabs_close(args, cb_); */
  var tabs_show;               /* tabs_show(args, cb_); */
  var tabs_focus;              /* tabs_focus(args, cb_); */
  var tabs_get;                /* tabs_get(args, cb_); */
  var tabs_load_url;           /* tabs_load_url(args, cb_); */
  var tabs_back_or_forward;    /* tabs_back_or_forward(args, cb_); */

  //
  // #### _private_
  //
  var tab_for_frame;           /* tab_for_frame(frame); */
  var visible_tab;             /* visible_tab(); */
  var show_tab;                /* show_tab(); */
  var push_state;              /* push_state(); */
  
  var frame_navigation_state;  /* frame_navigation_state(frame, state); */
  var frame_favicon_update;    /* frame_favicon_update(frame, favicons); */
  var frame_loading_start;     /* frame_loading_start(frame); */
  var frame_loading_stop;      /* frame_loading_stop(frame); */
  var frame_keyboard;          /* frame_keyboard(frame, event); */

  var browser_frame_created;   /* browser_frame_created(frame, disp, origin); */
  var browser_open_url;        /* browser_open_url(frame, disp, origin); */


  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### tab_for_frame
  //
  // Retrieves the tab associated with the specified frame
  // ```
  // @frame {exo_frame} the frame to search for
  // ```
  tab_for_frame = function(frame) {
    for(var id in my.tabs) {
      if(my.tabs.hasOwnProperty(id) &&
         my.tabs[id].frame === frame) {
        return my.tabs[id];
      }
    }
    return null;
  };

  // ### visible_tab
  //
  // Returns the current visible tab
  visible_tab = function() {
    return (my.tabs[my.visible] || null);
  };

  // ### show_tab
  //
  // Makes a specified tab visible
  // ```
  // @id  {string}    the tab id
  // @focus {boolean} wether to focus the page
  // @cb_ {function(err)} optional callback
  // ```
  show_tab = function(id, focus, cb_) {
    if(!my.tabs[id]) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    my.visible = id;
    my.core_module.exo_browser().show_page(my.tabs[id].frame, function(err) {
      if(err) {
        return cb_(err);
      }
      else if(focus) {
        my.tabs[id].frame.focus(cb_);
      }
      else {
        return cb_();
      }
    });
  };

  // ### push_state
  //
  // Pushes the state by emitting a `tabs:state` event
  push_state = function() {
    var state = {}
    Object.keys(my.tabs).forEach(function(id) {
      state[id] = my.tabs[id].state;
      state[id].loading = my.tabs[id].loading;
      state[id].visible = (my.visible === id);
    });
    my.session.module_manager().core_emit('tabs:state', state);
  };

  /****************************************************************************/
  /* EXOBROWSER EVENTS */
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
    var t = tab_for_frame(frame);
    if(t) {
      /* We clear the box_value for this page only if the state visible entry */
      /* `id` has changed (we navigated somewhere)                            */
      var new_id = null, old_id = null;
      var new_href = null, old_href = null;
      t.state.entries.forEach(function(n) { 
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
      
      t.state = state;
      t.state.entries.forEach(function(n) {
        if(my.favicons[n.id]) {
          t.favicon = my.favicons[n.id];
        }
      });
      // var entry = t.state.entries[t.state.entries.length - 1];
      // console.log('ENTRY [' + entry.id + ']: ' + entry.url.href);

      if(new_id !== old_id && new_id !== null) {
        push_state();
      }
      else if(new_href !== old_href && new_href != null) {
        push_state();
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
    var t = tab_for_frame(frame);
    if(favicons.length > 0 && t) {
      t.state.entries.forEach(function(n) {
        if(n.visible) {
          my.favicons[n.id] = favicons[0];
          n.favicon = favicons[0];
        }
      });
      push_state();
    }
  }; 

  // ### frame_loading_start
  //
  // One frame started loading so we should update our internal state and emit
  // an event if the frame is visible
  // ```
  // @frame    {exo_frame} the target frame
  // ```
  frame_loading_start = function(frame) {
    var t = tab_for_frame(frame);
    if(t) {
      t.loading = true;
      push_state();
    }
  }; 

  // ### frame_loading_stop
  //
  // One frame stopped loading so we should update our internal state and emit
  // an event if the frame is visible
  // ```
  // @frame    {exo_frame} the target frame
  // ```
  frame_loading_stop = function(frame) {
    var t = tab_for_frame(frame);
    if(t) {
      t.loading = false;
      push_state();
    }
  }; 

  // ### frame_keyboard
  //
  // Called when a keyboard event is sent to any frame in the ExoBrowser. We
  // filter for the frame we recognize and redistribute the event
  // ```
  // @frame {exo_frame} the target frame of the event
  // @event {object} the keyboard evet
  // ```
  frame_keyboard = function(frame, event) {
    var t = tab_for_frame(frame);
    if(t) {
      event.frame = {
        id: t.id,
        type: 'tab'
      };
      my.session.module_manager().core_emit('tabs:keyboard', event);
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

    var t = {
      frame: frame,
      id: common.hash([++my.frame_cnt]),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      }
    };
    my.tabs[t.id] = t;

    my.core_module.exo_browser().add_page(t.frame, function(err) {
      if(disposition === 'new_foreground_tab') {
        show_tab(t.id, true);
      }
      push_state();
    });
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
      visible_tab().frame.load_url(url);
      return;
    }

    var t = {
      frame: api.exo_frame({
        url: url,
        session: my.core_module.exo_session()
      }),
      id: common.hash([++my.frame_cnt]),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      }
    };
    my.tabs[t.id] = t;

    my.core_module.exo_browser().add_page(t.frame, function(err) {
      if(disposition === 'new_foreground_tab') {
        show_tab(t.id, true);
      }
      push_state();
    });
  };


  /****************************************************************************/
  /* EXPOSED PROCEDURES */
  /****************************************************************************/
  // ### tabs_new
  //
  // Creates a new tab and navigate to the specified URL.
  // ```
  // @args {object} { [url], [visible], [focus] }
  // @cb_  {function(err, res)}
  // ```
  tabs_new = function(args, cb_) {
    var t = {
      frame: api.exo_frame({
        url: args.url || '',
        session: my.core_module.exo_session()
      }),
      id: common.hash([++my.frame_cnt]),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      }
    };
    my.tabs[t.id] = t;

    async.series([
      function(cb_) {
        my.core_module.exo_browser().add_page(t.frame, function(err) {
          if(args.visible) {
            show_tab(t.id, args.focus, cb_);
          }
          return cb_();
        });
      },
      function(cb_) {
        push_state();
        return cb_();
      }
    ], function(err) {
      return cb_(err, { id: t.id });
    });
  };

  // ### tabs_close
  //
  // Closes a tab by id. Can specify another id to make visible.
  // ```
  // @args {object} { id, [next], [focus] }
  // @cb_  {function(err, res)}
  // ```
  tabs_close = function(args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    async.series([
      function(cb_) {
        delete my.tabs[args.id];
        if(args.next && my.tabs[args.next]) {
          show_tab(args.next, args.focus, cb_);
        }
        else if(my.tabs.length > 0) {
          for(var id in my.tabs) {
            if(my.tabs.hasOwnProperty(id)) {
              show_tab(id, args.focus, cb_);
              break;
            }
          }
        }
        else {
          return cb_();
        }
      }, 
      function(cb_) {
        my.core_module.exo_browser().remove_page(t.frame, function(err) {
          return t.frame.kill(cb_);
        });
      },
      function(cb_) {
        if(global.gc) global.gc();
        push_state();
        return cb_();
      }
    ], cb_);
  };

  // ### tabs_show
  //
  // Makes a particular tab visibile
  // ```
  // @args {object} { id, [focus] }
  // @cb_  {function(err, res)}
  // ```
  tabs_show = function(args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    async.series([
      function(cb_) {
        show_tab(t.id, args.focus, cb_);
      }, 
      function(cb_) {
        push_state();
        return cb_();
      }
    ], cb_);
  };

  // ### tabs_focus
  //
  // Focuses the tabs (and make it visible before if needed)
  // ```
  // @args {object} { id }
  // @cb_  {function(err, res)}
  // ```
  tabs_focus = function(args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    async.series([
      function(cb_) {
        if(my.visible !== t.id) {
          return show_tab(t.id, false, cb_);
        }
        else {
          return cb_();
        }
      },
      function(cb_) {
        return t.frame.focus(cb_);
      }
    ], cb_);
  };

  // ### tabs_get
  //
  // Retrieves the opened tabs
  // ```
  // @args {object} { [id] }
  // @cb_  {function(err, res)}
  // ```
  tabs_get = function(args, cb_) {
    if(args.id) {
      var t = my.tabs[args.id];
      if(!t) {
        return cb_(common.err('Invalid tab `id`: ' + args.id,
                              'core_tabs:invalid_tab'));
      }
      var tab = {
        state: t.state,
        loading: t.loading
      }
      return cb_(null, tab);
    }
    else {
      var tabs = [];
      Object.keys(my.tabs).forEach(function(id) {
        tabs.push({
          state: my.tabs[id].state,
          loading: my.tabs[id].loading
        });
      });
      return cb_(null, tabs);
    }
  };

  // ### tabs_load_url
  //
  // Loads the specified url in the specified tab
  // ```
  // @args {object} { id, url }
  // @cb_  {function(err, res)}
  // ```
  tabs_load_url = function(args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    t.frame.load_url(args.url, function(err) {
      return cb_(null, {});
    });
  };

  // ### tabs_back_or_forward
  //
  // Go back for the specified tab
  // ```
  // @args {object} { id, offset }
  // @cb_  {function(err, res)}
  // ```
  tabs_back_or_forward = function(args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    t.frame.go_back_or_forward(args.offset, function(err) {
      return cb_(null, {});
    });
  };

  /****************************************************************************/
  /* INITIALIZATION */
  /****************************************************************************/
  // ### init
  // 
  // Initialializes the core tabs module
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    my.core_module.exo_browser().on('frame_favicon_update', 
                                    frame_favicon_update);
    my.core_module.exo_browser().on('frame_loading_start', 
                                    frame_loading_start);
    my.core_module.exo_browser().on('frame_loading_stop', 
                                    frame_loading_stop);
    my.core_module.exo_browser().on('frame_created', 
                                    browser_frame_created);
    my.core_module.exo_browser().on('open_url', 
                                    browser_open_url);
    my.core_module.exo_browser().on('frame_navigation_state', 
                                    frame_navigation_state);
    my.core_module.exo_browser().on('frame_keyboard', 
                                    frame_keyboard);
    return cb_();
  };

  // ### kill
  //
  // Kills the core tabs module and all associated tabs
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  kill = function(cb_) {
    async.each(Object.keys(my.tabs), function(id, cb_) {
      var t = my.tabs[id];
      my.core_module.exo_browser().remove_page(t.frame, function(err) {
        delete my.tabs[id];
        return t.frame.kill(cb_);
      });
    }, cb_);
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'tabs_new', tabs_new, _super);
  common.method(that, 'tabs_close', tabs_close, _super);
  common.method(that, 'tabs_show', tabs_show, _super);
  common.method(that, 'tabs_focus', tabs_focus, _super);
  common.method(that, 'tabs_get', tabs_get, _super);
  common.method(that, 'tabs_load_url', tabs_load_url, _super);
  common.method(that, 'tabs_back_or_forward', tabs_back_or_forward, _super);

  return that;
};

exports.core_tabs = core_tabs;
