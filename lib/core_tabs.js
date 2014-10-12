/*
 * Breach: core_tabs.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-06-19 spolu  Add concept of `new_tab` to core_tabs
 * - 2014-06-16 spolu  Better favicon caching and handling
 * - 2014-06-10 spolu  Remove state update filter by entry id
 * - 2014-01-13 spolu  Creation
 */
"use strict"

var common = require('./common.js');
var async = require('async');
var api = require('exo_browser');

// ## core_tabs
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

  /* { id: { frame,           */
  /*         id,              */
  /*         state,           */
  /*         loading,         */
  /*         context_menu } } */
  my.tabs = {};
  my.favicons = {};
  my.visible = null;
  my.frame_cnt = 0;

  my.NEW_TAB_ID = '__NEW_TAB_ID__';
  my.new_tab_url = 'breach://splash';

  //
  // #### _public_
  //
  var init;                          /* init(cb_); */
  var kill;                          /* kill(cb_); */

  var tabs_new;                      /* tabs_new(args, cb_); */
  var tabs_close;                    /* tabs_close(args, cb_); */
  var tabs_show;                     /* tabs_show(args, cb_); */
  var tabs_focus;                    /* tabs_focus(args, cb_); */
  var tabs_get;                      /* tabs_get(args, cb_); */
  var tabs_current;                  /* tabs_current(args, cb_); */
  var tabs_list;                     /* tabs_list(args, cb_); */
  var tabs_load_url;                 /* tabs_load_url(args, cb_); */
  var tabs_back_or_forward;          /* tabs_back_or_forward(args, cb_); */
  var tabs_reload;                   /* tabs_reload(args, cb_); */
  var tabs_find_next;                /* tabs_find_next(args, cb_); */
  var tabs_find_stop;                /* tabs_find_stop(args, cb_); */
  var tabs_devtools;                 /* tabs_devtools(args, cb_); */
  var tabs_set_context_menu_builder; /* tabs_set_context_menu_builder(args, cb_); */
  var tabs_new_tab_url;              /* tabs_new_tab_url(args, cb_); */
  var tabs_state;                    /* tabs_state(args, cb_); */

  //
  // #### _private_
  //
  var next_id;                       /* next_id(); */
  var tab_for_frame;                 /* tab_for_frame(frame); */
  var visible_tab;                   /* visible_tab(); */
  var show_tab;                      /* show_tab(id, focus, cb_); */
  var push_state;                    /* push_state(); */
  var install_context_menu;          /* install_context_menu(); */

  var translate_url;                 /* translate_url(url); */
  
  var frame_navigation_state;        /* frame_navigation_state(frame, state); */
  var frame_favicon_update;          /* frame_favicon_update(frame, favicons); */
  var frame_loading_start;           /* frame_loading_start(frame); */
  var frame_loading_stop;            /* frame_loading_stop(frame); */
  var frame_keyboard;                /* frame_keyboard(frame, event); */
  var frame_find_reply;              /* frame_find_reply(frame, rid, matches, selection, active, final); */

  var browser_frame_created;         /* browser_frame_created(frame, disp, origin); */
  var browser_open_url;              /* browser_open_url(frame, disp, origin); */


  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // next_id
  //
  // Computes a new unique id
  next_id = function() {
    return common.hash([Date.now(), (++my.frame_cnt)]);
  };

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
  // @focus {boolean} whether to focus the page
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
      else if(focus && my.tabs[id]) {
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
      state[id].find_reply = my.tabs[id].find_reply;
    });
    my.session.module_manager().core_emit('tabs:state', state);
  };

  // ### install_context_menu
  //
  // Installs the context menu handler for a given tab
  // ```
  // @id  {string}    the tab id
  // ```
  install_context_menu = function(id) {
    if(!my.tabs[id]) {
      return;
    }
    var items = {};
    my.tabs[id].frame.set_context_menu_handler(function(params, cb_) {
      async.each(Object.keys(my.tabs[id].context_menu), function(src, cb_) {
        my.session.module_manager()
          .core_call(src, my.tabs[id].context_menu[src], {
          id: id,
          params: params
        }, function(err, res) {
          if(err) {
            /* If error, we ignore that source. */
            return cb_();
          }
          items[src] = res.items;
          return cb_();
        });
      }, function(err) {
        var final = [];
        Object.keys(items).forEach(function(src) {
          if(final.length > 0) {
            final.push({ item: null });
          }
          items[src].forEach(function(item) {
            final.push({
              item: item,
              trigger: function() {
                my.session.module_manager().core_emit('tabs:context_menu', {
                  src: src,
                  id: id,
                  item: item
                });
              }
            });
          });
        });
        if(final.length > 0) {
          final.push({ item: null });
        }
        final.push({ 
          item: 'Configure modules',
          trigger: function() {

            tabs_new('core', { 
              visible: true,
              focus: true,
              url: my.core_module.core_ui().url_for_ui('modules')
            }, function(err, res) {
              if(err) {
                common.log.error(err);
              }
              else {
                my.session.module_manager().core_emit('tabs:created', {
                  disposition: 'new_foreground_tab',
                  id: res.id
                });
                push_state();
              }
            });
          }
        });
        return cb_(null, final);
      });
    });
  };

  // ### translate_url
  //
  // Preprocess url sent to the core_tabs api for translation. Translation
  // occurs for `breach://` urls 
  // ```
  // @url {string} the url to translate
  // ```
  translate_url = function(url) {
    /* `breach://` translation. */
    var breach_url_r = /^breach\:\/\/(.*)$/;
    var breach_url_m = breach_url_r.exec(url);
    if(breach_url_m) {
      return my.core_module.core_ui().url_for_ui(breach_url_m[1]);
    }
    return url;
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
      state.entries.forEach(function(n) { 
        if(t.id === my.NEW_TAB_ID) {
          n.url.protocol = 'breach:';
          n.url.slashes = true;
          n.url.auth = null;
          n.url.host = '';
          n.url.port = null;
          n.url.hostname = '';
          n.url.hash = null;
          n.url.search = null;
          n.url.query = null;
          n.url.pathname = '';
          n.url.path = '';
          n.url.href = '';
        }
        var ui = my.core_module.core_ui().ui_for_url(n.url.href);
        if(ui) {
          n.url.protocol = 'breach:';
          n.url.slashes = true;
          n.url.auth = null;
          n.url.host = ui
          n.url.port = null;
          n.url.hostname = ui;
          n.url.hash = null;
          n.url.search = null;
          n.url.query = null;
          n.url.path = '';
          n.url.pathname = '';
          n.url.href = 'breach://' + ui;
        }
      });
      
      t.state = state;
      t.state.entries.forEach(function(n) {
        if(n.visible) {
          if(my.favicons[t.id] && my.favicons[t.id][n.url.host]) {
            n.favicon = my.favicons[t.id][n.url.host];
          }
        }
      });
      // var entry = t.state.entries[t.state.entries.length - 1];
      // console.log('ENTRY [' + entry.id + ']: ' + entry.url.href);

      push_state();
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
          my.favicons[t.id] = my.favicons[t.id] || {};
          my.favicons[t.id][n.url.host] = favicons[0];
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
  // @event {object} the keyboard event
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

  // ### frame_find_reply
  //
  // Called when a find action was sent on a frame and has received a reply.
  // We filter for the frame we recognize, update its state and push the newly
  // updated state.
  // ```
  // @frame {exo_frame} the target frame of the event
  // @event {object} the keyboard event
  // ```
  frame_find_reply = function(frame, rid, matches, selection, active, final) {
    var t = tab_for_frame(frame);
    if(t) {
      t.find_reply =  {
        rid: rid,
        matches: matches,
        selection: selection,
        active: active,
        final: final
      };
      push_state();
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
      id: next_id(),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      },
      loading: false,
      context_menu: {}
    };

    my.tabs[t.id] = t;
    install_context_menu(t.id);

    my.core_module.exo_browser().add_page(t.frame, function(err) {
      /* We emit an event `tabs:created` and let the module decide whether to */
      /* show or not the newly created tab.                                   */
      my.session.module_manager().core_emit('tabs:created', {
        disposition: disposition,
        id: t.id
      });
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
      id: next_id(),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      },
      loading: false,
      context_menu: {}
    };

    my.tabs[t.id] = t;
    install_context_menu(t.id);

    my.core_module.exo_browser().add_page(t.frame, function(err) {
      /* We emit an event `tabs:created` and let the module decide whether to */
      /* show or not the newly created tab.                                   */
      my.session.module_manager().core_emit('tabs:created', {
        disposition: disposition,
        id: t.id
      });
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
  // @src  {string} source module
  // @args {object} { [url], [visible], [focus], [id] }
  // @cb_  {function(err, res)}
  // ```
  tabs_new = function(src, args, cb_) {
    if(args.id && my.tabs[args.id]) {
      return cb_(common.err('Tab `id` already exists: ' + args.id,
                            'core_tabs:id_already_exists'));
    }
    var target_url = args.url || my.new_tab_url;

    var t = {
      frame: api.exo_frame({
        url: translate_url(target_url),
        session: my.core_module.exo_session()
      }),
      id: args.id ? args.id.toString() : next_id(),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      },
      loading: false,
      context_menu: {}
    };

    my.tabs[t.id] = t;
    install_context_menu(t.id);

    async.series([
      function(cb_) {
        my.core_module.exo_browser().add_page(t.frame, function(err) {
          if(args.visible) {
            show_tab(t.id, args.focus, cb_);
          }
          else {
            return cb_();
          }
        });
      },
      function(cb_) {
        push_state();
        // if the 'id' was not provided, we inform the module manager of the 
        // tab creation
        if(!args.id){
          var disposition = 
            args.visible ? 'new_foreground_tab' : 'new_background_tab';
          my.session.module_manager().core_emit('tabs:created', {
            disposition: disposition,
            id: t.id
          });
        }
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
  // @src  {string} source module
  // @args {object} { id, [next], [focus] }
  // @cb_  {function(err, res)}
  // ```
  tabs_close = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    async.series([
      function(cb_) {
        delete my.tabs[args.id];
        delete my.favicons[args.id];
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
        my.session.module_manager().core_emit('tabs:removed', {
          id: t.id
        });
        return cb_();
      }
    ], cb_);
  };

  // ### tabs_show
  //
  // Makes a particular tab visible
  // ```
  // @src  {string} source module
  // @args {object} { id, [focus] }
  // @cb_  {function(err, res)}
  // ```
  tabs_show = function(src, args, cb_) {
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
  // @src  {string} source module
  // @args {object} { id }
  // @cb_  {function(err, res)}
  // ```
  tabs_focus = function(src, args, cb_) {
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
  // @src  {string} source module
  // @args {object} { [id] }
  // @cb_  {function(err, res)}
  // ```
  tabs_get = function(src, args, cb_) {
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
      return tabs_list(src, args, cb_);
    }
  };
  
  // ### tabs_current
  // 
  // Returns the currently visible tab
  // ```
  // @src {string} source module
  // @args {}
  // @cb_ {function(err, res)}
  tabs_current = function(src, args, cb_) {
    Object.keys(my.tabs).forEach(function(id) {
      if (my.tabs[id].state.visible === true) {
        return cb_(null, {
          id: id,
          state: my.tabs[id].state,
          loading: my.tabs[id].loading
        });
      }
    });
  };
  
  // ### tabs_list
  // 
  // Returns a list of current tabs
  // ```
  // @src {string} source module
  // @args {object} {}
  // @cb_  {function(err, res)}
  tabs_list = function(src, args, cb_) {
    var tabs = [];
    Object.keys(my.tabs).forEach(function(id) {
      tabs.push({
        id: id,
        state: my.tabs[id].state,
        loading: my.tabs[id].loading
      });
    });
    return cb_(null, tabs);
  };

  // ### tabs_load_url
  //
  // Loads the specified url in the specified tab
  // ```
  // @src  {string} source module
  // @args {object} { id, url }
  // @cb_  {function(err, res)}
  // ```
  tabs_load_url = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    var target_url = args.url;

    t.frame.load_url(translate_url(target_url), cb_);
  };

  // ### tabs_back_or_forward
  //
  // Go back for the specified tab
  // ```
  // @src  {string} source module
  // @args {object} { id, offset }
  // @cb_  {function(err, res)}
  // ```
  tabs_back_or_forward = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    t.frame.go_back_or_forward(args.offset, cb_);
  };

  // ### tabs_reload
  //
  // Reload the specified tab
  // ```
  // @src  {string} source module
  // @args {object} { id }
  // @cb_  {function(err, res)}
  // ```
  tabs_reload = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    t.frame.reload(cb_);
  };

  // ### tabs_find_next
  //
  // Finds next match in the provided tab
  // ```
  // @src  {string} source module
  // @args {object} { id, text, forward, case, next }
  // @cb_  {function(err, res)}
  // ```
  tabs_find_next = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    t.frame.find(args.text || '', 
                 (typeof args.forward === 'undefined') ? true : args.forward, 
                 args.case || false, args.next || false, cb_);
  };

  // ### tabs_find_stop
  //
  // Stop finding matches in the provided tab
  // ```
  // @src  {string} source module
  // @args {object} { id, action }
  // @cb_  {function(err, res)}
  // ```
  tabs_find_stop = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    t.find_reply = null;
    t.frame.find_stop(args.action || 'clear', cb_);
    push_state();
  };

  // ### tabs_devtools
  //
  // Retrieves the DevTools URL for the given tab
  // ```
  // @src  {string} source module
  // @args {object} { id, element_at }
  // @cb_  {function(err, res)}
  // ```
  tabs_devtools = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    async.parallel({
      url: function(cb_) {
        my.core_module.exo_session().get_dev_tools_url(function(url) {
          return cb_(null, url);
        });
      },
      id: function(cb_) {
        t.frame.dev_tools_get_id(function(id) {
          return cb_(null, id);
        });
      },
      element_at: function(cb_) {
        if(args.element_at) {
          t.frame.dev_tools_inspect_element_at(args.element_at.x,
                                               args.element_at.y, cb_);
        }
        else {
          return cb_();
        }
      }
    }, cb_);
  };

  // ### tabs_set_context_menu_builder
  //
  // Registers a context menu handler for the calling module. The procedure
  // specified will get called when the context menu needs to get built. If no
  // procedure is specified, then the module calling is unregistered.
  //
  // That procedure returns an array of menu items `{ items: [] }`. When an 
  // entry is clicked the core module will emit an event `tabs:context_menu`
  // with event parameters the tab `id` and the `item` and `src` of the item
  // clicked.
  // ```
  // @src  {string} source module
  // @args {object} { id, [procedure] }
  // @cb_  {function(err, res)}
  // ```
  tabs_set_context_menu_builder = function(src, args, cb_) {
    var t = my.tabs[args.id];
    if(!t) {
      return cb_(common.err('Invalid tab `id`: ' + args.id,
                            'core_tabs:invalid_tab'));
    }
    if(args.procedure) {
      t.context_menu[src] = args.procedure;
    }
    else {
      delete t.context_menu[src];
    }
    return cb_();
  };

  // ### tabs_new_tab_url
  //
  // Sets the new tab url as well (also used as default URL).
  // ```
  // @src  {string} source module
  // @args {object} { url }
  // @cb_  {function(err, res)}
  // ```
  tabs_new_tab_url = function(src, args, cb_) {
    my.new_tab_url = args.url;

    if(my.tabs[my.NEW_TAB_ID]) {
      my.tabs[my.NEW_TAB_ID].frame.load_url(translate_url(my.new_tab_url), cb_);
    }
    else {
      return cb_();
    }
  };

  // ### tabs_state
  //
  // Retrieves the current tabs state (normally sent through push_state)
  // ```
  // @src  {string} source module
  // @args {object} { }
  // @cb_  {function(err, res)}
  // ```
  tabs_state = function(src, args, cb_) {
    var state = {}
    Object.keys(my.tabs).forEach(function(id) {
      state[id] = my.tabs[id].state;
      state[id].loading = my.tabs[id].loading;
      state[id].visible = (my.visible === id);
    });
    return cb_(null, state);
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
    my.core_module.exo_browser().on('frame_find_reply', 
                                    frame_find_reply);

    /* The new tab page is opened in core_ui as soon as the server is ready. */
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
        if(err) {
          /* We ignore the error as the browser may have already been */
          /* killed when we get here.                                 */
          common.log.error(err);
        }
        delete my.tabs[id];
        delete my.favicons[id];
        return t.frame.kill(function(err) {
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

  common.method(that, 'tabs_new', tabs_new, _super);
  common.method(that, 'tabs_close', tabs_close, _super);
  common.method(that, 'tabs_show', tabs_show, _super);
  common.method(that, 'tabs_focus', tabs_focus, _super);
  common.method(that, 'tabs_get', tabs_get, _super);
  common.method(that, 'tabs_current', tabs_current, _super);
  common.method(that, 'tabs_list', tabs_list, _super);
  common.method(that, 'tabs_load_url', tabs_load_url, _super);
  common.method(that, 'tabs_back_or_forward', tabs_back_or_forward, _super);
  common.method(that, 'tabs_reload', tabs_reload, _super);
  common.method(that, 'tabs_find_next', tabs_find_next, _super);
  common.method(that, 'tabs_find_stop', tabs_find_stop, _super);
  common.method(that, 'tabs_devtools', tabs_devtools, _super);
  common.method(that, 'tabs_set_context_menu_builder', tabs_set_context_menu_builder, _super);
  common.method(that, 'tabs_new_tab_url', tabs_new_tab_url, _super);
  common.method(that, 'tabs_state', tabs_state, _super);

  return that;
};

exports.core_tabs = core_tabs;
