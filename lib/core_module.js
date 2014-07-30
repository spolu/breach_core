/*
 * Breach: core_module.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-19 spolu   Integration of `core_store`
 * - 2014-01-13 spolu   Split in multiple files
 * - 2013-12-07 spolu   Creation
 */
var common = require('./common.js');
var api = require('exo_browser');
var async = require('async');

// ## core_module
//
// Breach `core` module implementation.
//
// The `core` module exposes Breach API to other modules and maintains the
// navigation state. The navigation state is tracked and synchronized across
// devices by the `core` module. It is also exposed to other modules along with
// mutators to update the navigation state.
//
// ```
// @spec { session }
// @inherits {}
// ```
var core_module = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.VERSION = require('./../package.json').version;

  my.session = spec.session;

  my.core_tabs = null;
  my.core_controls = null;
  my.core_ui = null;

  my.exo_browser = null;
  my.exo_session = null;
  my.popups = [];

  my.kill_sentinel = false;


  //
  // #### _public_
  //
  var init;                       /* init(cb_); */
  var kill;                       /* kill(cb_); */

  //
  // #### _private_
  //
  var browser_frame_created;      /* browser_frame_created(f, disp, post, origin); */
  var browser_frame_close;        /* browser_frame_close(f); */
  var browser_open_url;           /* browser_open_url(url, disp, origin); */
  var browser_kill;               /* browser_kill(); */

  var frame_navigation_state;     /* frame_navigation_state(frame, state); */
  var frame_keyboard;             /* frame_keyboard(frame, event); */

  var auto_update_state;          /* auto_update_state(src, args, cb_); */
  var auto_update_install_breach; /* auto_update_state(src, args, cb_); */

  var modules_add;                /* modules_add(src, args, cb_); */
  var modules_install;            /* modules_install(src, args, cb_); */
  var modules_remove;             /* modules_remove(src, args, cb_); */
  var modules_update;             /* modules_update(src, args, cb_); */
  var modules_run;                /* modules_run(src, args, cb_); */
  var modules_kill;               /* modules_kill(src, args, cb_); */
  var modules_list;               /* modules_list(src, args, cb_); */
  
  var set_title;                  /* set_title(src, args, cb_); */
  
  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* EXOBROWSER EVENTS */
  /****************************************************************************/
  // ### browser_frame_created
  //
  // Event received when a new frame has been created (generally a popup).
  // Depending on the disposition, we'll ignore it (handled by the stack) or 
  // we'll create a new exo_browser to handle the detached popup
  // ```
  // @frame       {exo_frame} the newly created frame
  // @disposition {string} the disposition for opening that frame
  // @initial_pos {array} initial rect
  // @origin      {exo_frame} origin exo_frame
  // ```
  browser_frame_created = function(frame, disposition, initial_pos, from) {
    if(disposition === 'new_window') {
      /* TODO(spolu): Handle new window. */
      console.log('new_window: ' + from);
    }

    if(disposition === 'new_popup') {
      /* TODO(spolu): make maximization optional */
      var popup = api.exo_browser({
        size: [initial_pos[2] || 640, initial_pos[3] || 480]
      });
      popup.add_page(frame, function() {
        popup.show_page(frame);
      });
      my.popups.push(popup);
      popup.on('kill', function() {
        common.remove(my.popups, popup);
        frame.kill();
        /* We call the gc if available (recommended) to make sure the      */
        /* underlying exoframe (and its webcontents) gets deleted. So that */
        /* the popup can get reopened.                                      */
        if(global.gc)
          global.gc();
      });
      popup.on('frame_close', function() {
        /* There can be only one */
        frame.kill();
        popup.kill();
      });
      popup.set_title('Breach');
      popup.on('frame_navigation_state', function(frame, state) {
        state.entries.forEach(function(e) {
          if(e.visible) {
            popup.set_title(e.title);
          }
        });
      });
    }

    /* TODO(spolu): Handle other dispositions. */
  };

  // ### browser_frame_close
  //
  // Event dispatched when a frame should be closed (generally triggered
  // programmatically)
  // ```
  // @frame  {exo_frame} the frame to close
  // ```
  browser_frame_close = function(frame) {
    /* TODO(spolu): Is this possible? */
    console.log('FRAME_CLOSE [session]: ' + frame.name());
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
    console.log('OPEN_URL: ' + url + ' [' + disposition + ']');
    if(disposition === 'new_window') {
      /* TODO(spolu): Handle new window. */
    }
    if(disposition === 'new_popup') {
      /* TODO(spolu): Handle new Popup. */
    }
    /*TODO(spolu): Handle other disposition not handled by the stack. */
  };

  // ### browser_kill
  //
  // Event received when the underlying exobrowser is killed (no more frames)
  // or window closed. We should clean up everything so that all objects get
  // reclaimed by the GC.
  browser_kill = function() {
    if(!my.kill_sentinel) {
      my.session.kill();
    }
  };

  // ### frame_navigation_state
  //
  // Received when an update has been made to the navigation state of a frame.
  // ```
  // @frame {exo_frame} the target_frame
  // @state {object} the navigation state
  // ```
  frame_navigation_state = function(frame, state) {
    /* ExoSession VisitedLink Update. */
    if(state.entries.length > 0) {
      var href = state.entries[state.entries.length - 1].url.href;
      my.exo_session.add_visited_link(href);
    }
  };

  // ### frame_keyboard
  //
  // Called when a keyboard event is sent to any frame in the ExoBrowser. We 
  // use it here to install handler for the edit commands on the `darwin` 
  // platform where native edit commands are disabled by default.
  // ```
  // @frame {exo_frame} the target frame of the event
  // @event {object} the keyboard event
  // ```
  frame_keyboard = function(frame, evt) {
    if(process.platform === 'darwin') {
      var modifier = (1 << 3); /* command */
      var modifier_key = 91;

      /* Command - C ; */
      if(evt.type === 7 && (evt.modifiers === modifier) &&
         evt.keycode === 67) {
        frame.copy_selection();
      }
      /* Command - V ; */
      if(evt.type === 7 && (evt.modifiers === modifier) &&
         evt.keycode === 86) {
        frame.paste();
      }
      /* Command - X ; */
      if(evt.type === 7 && (evt.modifiers === modifier) &&
         evt.keycode === 88) {
        frame.cut_selection();
      }
      /* Command - A ; */
      if(evt.type === 7 && (evt.modifiers === modifier) &&
         evt.keycode === 65) {
        frame.select_all();
      }
      /* Command - Q ; */
      if(evt.type === 7 && (evt.modifiers === modifier) &&
         evt.keycode === 81) {
        common.exit(0);
      }
    }
  };

  /****************************************************************************/
  /* EXPOSED PROCEDURES */
  /****************************************************************************/
  // ### auto_update_state
  //
  // Returns the state of the auto_update system (Breach and Modules)
  // ```
  // @src  {string} source module
  // @args {object} { }
  // @cb_  {function(err, res)}
  // ```
  auto_update_state = function(src, args, cb_) {
    var state = {
      breach: {},
      modules: []
    };
    if(common.auto_updater) {
      state.breach = {
        update_ready: common.auto_updater.update_ready(),
        update_available: common.auto_updater.update_available(),
        update: common.auto_updater.update()
      }
    }
    my.session.module_manager().list(function(err, modules) {
      if(err) {
        return cb_(err);
      }
      Object.keys(modules).forEach(function(m) {
        if(modules[m].need_restart) {
          state.modules.push(modules[m]);
        }
      });
      return cb_(null, state);
    });
  };

  // ### auto_install_breach
  //
  // Triggers the installation of the new version of Breach if ready.
  // ```
  // @src  {string} source module
  // @args {object} { }
  // @cb_  {function(err, res)}
  // ```
  auto_update_install_breach = function(src, args, cb_) {
    if(common.auto_updater) {
      common.auto_updater.install_update(cb_);
    }
    else {
      return cb_(common.err('Auto Updater not found',
                            'core_module:no_auto_updater'));
    }
  };

  // ### modules_add
  //
  // Adds the module specified by path
  // ```
  // @src  {string} source module
  // @args {object} { path }
  // @cb_  {function(err, res)}
  // ```
  modules_add = function(src, args, cb_) {
    if(!args || !args.path) {
      return cb_(common.err('Missing `path` argument',
                            'core_module:missing_path'));
    }
    my.session.module_manager().add(args.path, false, cb_);
  };

  // ### modules_install
  //
  // Installs the module specified by path
  // ```
  // @src  {string} source module
  // @args {object} { path }
  // @cb_  {function(err, res)}
  // ```
  modules_install = function(src, args, cb_) {
    if(!args || !args.path) {
      return cb_(common.err('Missing `path` argument',
                            'core_module:missing_path'));
    }
    my.session.module_manager().install(args.path, cb_);
  };

  // ### modules_remove
  //
  // Removes the module specified by path
  // ```
  // @src  {string} source module
  // @args {object} { path }
  // @cb_  {function(err, res)}
  // ```
  modules_remove = function(src, args, cb_) {
    if(!args || !args.path) {
      return cb_(common.err('Missing `path` argument',
                            'core_module:missing_path'));
    }
    my.session.module_manager().remove(args.path, cb_);
  };

  // ### modules_update
  //
  // Triggers the update of the module specified by path
  // ```
  // @src  {string} source module
  // @args {object} { path }
  // @cb_  {function(err, res)}
  // ```
  modules_update = function(src, args, cb_) {
    if(!args || !args.path) {
      return cb_(common.err('Missing `path` argument',
                            'core_module:missing_path'));
    }
    my.session.module_manager().update(args.path, cb_);
  };

  // ### modules_run
  //
  // Runs the module specified by path
  // ```
  // @src  {string} source module
  // @args {object} { path }
  // @cb_  {function(err, res)}
  // ```
  modules_run = function(src, args, cb_) {
    if(!args || !args.path) {
      return cb_(common.err('Missing `path` argument',
                            'core_module:missing_path'));
    }
    my.session.module_manager().run_module(args.path, cb_);
  };

  // ### modules_kill
  //
  // Runs the module specified by path
  // ```
  // @src  {string} source module
  // @args {object} { path }
  // @cb_  {function(err, res)}
  // ```
  modules_kill = function(src, args, cb_) {
    if(!args || !args.path) {
      return cb_(common.err('Missing `path` argument',
                            'core_module:missing_path'));
    }
    my.session.module_manager().kill_module(args.path, cb_);
  };

  // ### modules_list
  //
  // List the modules state
  // ```
  // @src  {string} source module
  // @args {object} { }
  // @cb_  {function(err, res)}
  // ```
  modules_list = function(src, args, cb_) {
    my.session.module_manager().list(cb_);
  };

  // ### set_title
  //
  // Set the ExoBrowser window title
  // ```
  // @src  {string} source module
  // @args {object} { }
  // @cb_  {function(err, res)}
  // ```
  set_title = function(src, args, cb_) {
    my.exo_browser.set_title(args.title || 'Breach');
  };


  /****************************************************************************/
  /* INITIALIZATION */
  /****************************************************************************/
  // ### init
  // 
  // Initializes the core module
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    /* Core Tabs. */
    my.core_tabs = require('./core_tabs.js').core_tabs({
      core_module: that,
      session: my.session
    });
    /* Core Controls. */
    my.core_controls = require('./core_controls.js').core_controls({
      core_module: that,
      session: my.session
    });
    /* Core UI. */
    my.core_ui = require('./core_ui.js').core_ui({
      core_module: that,
      session: my.session
    });
    /* Core Store. */
    my.core_store = require('./core_store.js').core_store({
      core_module: that,
      session: my.session
    });
    /* Core Cookies. */
    my.core_cookies = require('./core_cookies.js').core_cookies({
      core_module: that,
      session: my.session
    });

    /* ExoSession. */
    my.exo_session = api.exo_session({
      path: my.session.data_path(),
      off_the_record: my.session.off_the_record(),
      cookie_handlers: {
        load_for_key: my.core_cookies.load_for_key,
        flush: my.core_cookies.flush,
        add: my.core_cookies.add,
        remove: my.core_cookies.remove,
        update_access_time: my.core_cookies.update_access_time,
        force_keep_session_state: my.core_cookies.force_keep_session_state
      }
    });
    /* ExoBrowser. */
    my.exo_browser = api.exo_browser({
      size: [1200, 800],
      //size: [800, 600],
      icon_path: require('path').join(__dirname, '../breach.png')
    });

    my.exo_browser.set_title('Breach');
    //my.exo_browser.maximize();
    my.exo_browser.focus();

    my.exo_browser.on('frame_created', browser_frame_created);
    my.exo_browser.on('frame_close', browser_frame_close);
    my.exo_browser.on('open_url', browser_open_url);
    my.exo_browser.on('kill', browser_kill);

    my.exo_browser.on('frame_navigation_state', frame_navigation_state);
    my.exo_browser.on('frame_keyboard', frame_keyboard);

    /* Tabs API. */
    my.session.module_manager().core_expose('tabs_new', my.core_tabs.tabs_new);
    my.session.module_manager().core_expose('tabs_close', my.core_tabs.tabs_close);
    my.session.module_manager().core_expose('tabs_show', my.core_tabs.tabs_show);
    my.session.module_manager().core_expose('tabs_focus', my.core_tabs.tabs_focus);
    my.session.module_manager().core_expose('tabs_get', my.core_tabs.tabs_get);
    my.session.module_manager().core_expose('tabs_current', my.core_tabs.tabs_current);
    my.session.module_manager().core_expose('tabs_list', my.core_tabs.tabs_list);
    my.session.module_manager().core_expose('tabs_load_url', my.core_tabs.tabs_load_url);
    my.session.module_manager().core_expose('tabs_back_or_forward', my.core_tabs.tabs_back_or_forward);
    my.session.module_manager().core_expose('tabs_reload', my.core_tabs.tabs_reload);
    my.session.module_manager().core_expose('tabs_find_next', my.core_tabs.tabs_find_next);
    my.session.module_manager().core_expose('tabs_find_stop', my.core_tabs.tabs_find_stop);
    my.session.module_manager().core_expose('tabs_devtools', my.core_tabs.tabs_devtools);
    my.session.module_manager().core_expose('tabs_set_context_menu_builder', my.core_tabs.tabs_set_context_menu_builder);
    my.session.module_manager().core_expose('tabs_new_tab_url', my.core_tabs.tabs_new_tab_url);
    my.session.module_manager().core_expose('tabs_state', my.core_tabs.tabs_state);

    /* Controls API. */
    my.session.module_manager().core_expose('controls_set', my.core_controls.controls_set);
    my.session.module_manager().core_expose('controls_unset', my.core_controls.controls_unset);
    my.session.module_manager().core_expose('controls_dimension', my.core_controls.controls_dimension);
    my.session.module_manager().core_expose('controls_focus', my.core_controls.controls_focus);

    /* Store API. */
    my.session.module_manager().core_expose('store_register', my.core_store.store_register);
    my.session.module_manager().core_expose('store_get', my.core_store.store_get);
    my.session.module_manager().core_expose('store_push', my.core_store.store_push);

    /* Session API. */
    my.session.module_manager().core_expose('session_kill', function(src, args, cb_) {
      setTimeout(function() {
        my.session.kill(function() {});
      });
      return cb_();
    });

    /* Auto-Update API. */
    my.session.module_manager().core_expose('auto_update_state', auto_update_state);
    my.session.module_manager().core_expose('auto_update_install_breach', auto_update_install_breach);

    if(common.auto_updater) {
      common.auto_updater.on('update_available', function(update) {
        my.session.module_manager().core_emit('auto_update:breach_update_available', update);
      });
      common.auto_updater.on('update_ready', function(update) {
        my.session.module_manager().core_emit('auto_update:breach_update_ready', update);
      });
    }
    my.session.module_manager().on('update_ready', function(module) {
      my.session.module_manager().core_emit('auto_update:module_update_ready', module);
    });

    /* Module Management API. */
    my.session.module_manager().core_expose('modules_add', modules_add);
    my.session.module_manager().core_expose('modules_install', modules_install);
    my.session.module_manager().core_expose('modules_remove', modules_remove);
    my.session.module_manager().core_expose('modules_update', modules_update);
    my.session.module_manager().core_expose('modules_run', modules_run);
    my.session.module_manager().core_expose('modules_kill', modules_kill);
    my.session.module_manager().core_expose('modules_list', modules_list);
    my.session.module_manager().on('state_change', function(module) {
      my.session.module_manager().core_emit('modules:state_change', module);
    });

    /* Version API. */
    my.session.module_manager().core_expose('version', function(src, args, cb_) {
      return cb_(null, my.VERSION);
    });

    /* ExoBrowser Title. */
    my.session.module_manager().core_expose('set_title', set_title);


    var inits = [
      my.core_tabs,
      my.core_controls,
      my.core_ui,
      my.core_store,
      my.core_cookies,
    ];
    async.each(inits, function(sub, cb_) {
      return sub.init(cb_);
    }, cb_);
  };

  // ### kill
  //
  // Kills the core module and all associated resources
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  kill = function(cb_) {
    my.kill_sentinel = true;
    common.log.out('[core_module] KILL');
    var kills = [
      my.core_tabs,
      my.core_controls,
      my.core_ui,
      my.core_store,
    ];
    async.series([
      function(cb_) {
        async.each(kills, function(sub, cb_) {
          return sub.kill(cb_);
        }, cb_);
      },
      function(cb_) {
        return my.exo_browser.kill(function(err) {
          if(err) {
            /* We ignore the error as the browser may have already been */
            /* killed when we get here.                                 */
            common.log.error(err);
          }
          return cb_();
        });
      },
      function(cb_) {
        return my.exo_session.kill(function(err) {
          if(err) {
            /* We ignore the error as the session may have already been */
            /* killed when we get here.                                 */
            common.log.error(err);
          }
          return cb_();
        });
      },
      function(cb_) {
        delete my.exo_browser;
        delete my.exo_session;
        delete my.core_tabs;
        delete my.core_controls;

        if(global.gc) global.gc();
        return cb_();
      }
    ], cb_);
  };

  common.getter(that, 'session', my, 'session');
  common.getter(that, 'exo_browser', my, 'exo_browser');
  common.getter(that, 'exo_session', my, 'exo_session');

  common.getter(that, 'core_tabs', my, 'core_tabs');
  common.getter(that, 'core_controls', my, 'core_controls');
  common.getter(that, 'core_ui', my, 'core_ui');

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.core_module = core_module;
