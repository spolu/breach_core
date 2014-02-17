/*
 * Breach: core_module.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-01-13 spolu   Split in multiple files
 * 2013-12-07 spolu   Creation
 */
var common = require('./common.js');
var api = require('exo_browser');
var async = require('async');

// ## core_module
//
// Breach `core` module implementation.
//
// The `core` module exposes Breach API to other modules and maintain the
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

  my.session = spec.session;

  my.core_tabs = null;

  my.exo_browser = null;
  my.exo_session = null;
  my.popups = [];


  //
  // #### _public_
  //
  var init;                  /* init(cb_); */
  var kill;                  /* kill(cb_); */

  //
  // #### _private_
  //
  var browser_frame_created; /* browser_frame_created(f, disp, post, origin); */
  var browser_frame_close;   /* browser_frame_close(f); */
  var browser_open_url;      /* browser_open_url(url, disp, origin); */
  var browser_kill;          /* browser_kill(); */

  var frame_navigation_state /* frame_navigation_state(frame, state); */
  
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
      /* TODO(spolu): get the size of the popup from the API */
      /* TODO(spolu): make maximization optionnal */
      var popup = api.exo_browser({
        size: [initial_pos[2] || 640, initial_pos[3] || 480]
      });
      popup.show_page(frame);
      my.popups.push(popup);
      popup.on('kill', function() {
        common.remove(my.popups, popup);
        /* We call the gc if available (recommended) to make sure the      */
        /* underlying exoframe (and its webcontents) gets deleted. So that */
        /* the popup can get reopend.                                      */
        if(global.gc)
          global.gc();
      });
      popup.on('frame_close', function() {
        /* There can be only one */
        popup.kill();
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
    /*TODO(spolu): Handle other dispsition not handled by the stack. */
  };

  // ### browser_kill
  //
  // Event received when the underlying exobrowser is killed (no more frames)
  // or window closed. We should clean up everything so that all objects get
  // reclaimed by the GC.
  browser_kill = function() {
    that.kill();
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



  /****************************************************************************/
  /* INITIALIZATION */
  /****************************************************************************/
  // ### init
  // 
  // Initialializes the core module
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

    /* ExoSession. */
    my.exo_session = api.exo_session({
      path: my.session.data_path(),
      off_the_record: my.session.off_the_record()
    });
    /* ExoBrowser. */
    my.exo_browser = api.exo_browser({
      size: [1200, 768],
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

    /*
    my.admin_frame = api.exo_frame({
      name: my.exo_browser.name() + '_loading',
      url: my.base_url + '/loading.html',
      session: my.exo_session
    });
    my.exo_browser.show_page(my.admin_frame);
    */

    /* API. */
    my.session.module_manager().core_expose('tabs_new', my.core_tabs.tabs_new);
    my.session.module_manager().core_expose('tabs_close', my.core_tabs.tabs_close);
    my.session.module_manager().core_expose('tabs_show', my.core_tabs.tabs_show);
    my.session.module_manager().core_expose('tabs_focus', my.core_tabs.tabs_focus);
    my.session.module_manager().core_expose('tabs_get', my.core_tabs.tabs_get);
    my.session.module_manager().core_expose('tabs_load_url', my.core_tabs.tabs_load_url);
    my.session.module_manager().core_expose('tabs_back_or_forward', my.core_tabs.tabs_back_or_forward);
    my.session.module_manager().core_expose('tabs_reload', my.core_tabs.tabs_reload);
    my.session.module_manager().core_expose('tabs_devtools', my.core_tabs.tabs_devtools);
    my.session.module_manager().core_expose('tabs_default_url', my.core_tabs.tabs_default_url);

    my.session.module_manager().core_expose('controls_set', my.core_controls.controls_set);
    my.session.module_manager().core_expose('controls_unset', my.core_controls.controls_unset);
    my.session.module_manager().core_expose('controls_dimension', my.core_controls.controls_dimension);
    my.session.module_manager().core_expose('controls_focus', my.core_controls.controls_focus);

    my.session.module_manager().core_expose('session_kill', function(args, cb_) {
      process.nextTick(function() {
        my.session.kill(function() {});
      });
      return cb_();
    });

    var inits = [
      my.core_tabs,
      my.core_controls
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
    var kills = [
      my.core_tabs,
      my.core_controls
    ];
    async.series([
      function(cb_) {
        async.each(kills, function(sub, cb_) {
          return sub.kill(cb_);
        }, cb_);
      },
      function(cb_) {
        return my.exo_browser.kill(cb_);
      },
      function(cb_) {
        return my.exo_session.kill(cb_);
      },
      function(cb_) {
        delete my.exo_browser;
        delete my.exo_session;
        delete my.core_tabs;
        delete my.core_controls;

        //if(global.gc) global.gc();
        return cb_();
      }
    ], cb_);
  };

  common.getter(that, 'session', my, 'session');
  common.getter(that, 'exo_browser', my, 'exo_browser');
  common.getter(that, 'exo_session', my, 'exo_session');

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.core_module = core_module;
