/*
 * Breach: session.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-11-14 spolu   FMA refactoring
 * 2013-10-21 spolu   Cookie Store integration for v0.1
 * 2013-09-05 spolu   Fix #56
 * 2013-08-12 spolu   Creation
 */
var events = require('events');
var async = require('async');
var path = require('path');
var mkdirp = require('mkdirp');

var api = require('exo_browser');

var common = require('./common.js');
var factory = common.factory;

// ## session
//
// ```
// @spec { session_id, off_the_record, base_url }
// ```
var session = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.base_url = spec.base_url;
  my.session_id = spec.session_id || 'NO_SESSION_ID';

  my.off_the_record = spec.off_the_record || false;
  my.data_path = my.off_the_record ? null : 
    path.join(api.data_path('breach'), 'sessions', my.session_id);

  my.exo_browser = null;
  my.popups = [];
  my.module_processes = [];

  /* ExoFrame used to display information relative to the `core` module. */
  /* Such as the initial loading page or module configuration.           */
  my.admin_frame = null;

  //
  // #### _public_
  //
  var init;          /* init(cb_); */
  var kill;          /* kill(cb_); */

  //
  // #### _private_
  //
  var browser_frame_created; /* browser_frame_created(f, disp, post, origin); */
  var browser_frame_close;   /* browser_frame_close(f); */
  var browser_open_url;      /* browser_open_url(url, disp, origin); */
  var browser_kill;          /* browser_kill(); */

  //
  // #### _that_
  //
  var that = new events.EventEmitter();


  // ### init
  // 
  // Initialializes this session and spawns the associated exo_browser
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    async.series([
      function(cb_) {
        if(!my.off_the_record) {
          mkdirp(my.data_path, cb_);
        }
        else {
          return cb_();
        }
      },
      function(cb_) {
        my.module_manager = require('./module_manager.js').module_manager({
          session: that
        });
        my.cookie_store = require('./cookie_store.js').cookie_store({
          session: my.exo_session
        });

        my.module_manager.on('init:list', function(modules) {
          factory.log().out('init:list');
          factory.log().out(JSON.stringify(modules, null , 2));
        });
        my.module_manager.on('init:check', function(module, status) {
          factory.log().out('init:check');
          factory.log().out(JSON.stringify(module, null , 2));
          factory.log().out(status);
        });
        my.module_manager.on('init:install', function(module, status) {
          factory.log().out('init:install');
          factory.log().out(JSON.stringify(module, null , 2));
          factory.log().out(status);
        });
        my.module_manager.on('init:start', function(module) {
          factory.log().out('init:start');
          factory.log().out(JSON.stringify(module, null , 2));
        });
        my.module_manager.on('init:fail', function(module, err) {
          factory.log().out('init:fail');
          factory.log().out(JSON.stringify(module, null , 2));
          factory.log().out(err.stack);
        });

        my.exo_browser = api.exo_browser({
          //size: [1200, 768],
          size: [800, 600],
          icon_path: path.join(__dirname, '../breach.png')
        });
        my.exo_browser.set_title('Breach');
        //my.exo_browser.maximize();
        my.exo_browser.focus();

        my.exo_session = api.exo_session({
          path: my.data_path,
          off_the_record: my.off_the_record
        });

        my.exo_browser.on('frame_created', browser_frame_created);
        my.exo_browser.on('frame_close', browser_frame_close);
        my.exo_browser.on('open_url', browser_open_url);
        my.exo_browser.on('kill', browser_kill);

        my.admin_frame = api.exo_frame({
          name: my.exo_browser.name() + '_loading',
          url: my.base_url + '/loading.html',
          session: my.exo_session
        });
        my.exo_browser.add_page(my.admin_frame, function() {
          my.exo_browser.show_page(my.admin_frame);
        });

        my.exo_browser.on('frame_navigation_state', function(frame, state) {
          if(state.entries.length > 0) {
            var href = state.entries[state.entries.length - 1].url.href;
            my.exo_session.add_visited_link(href);
          }
        });

        return cb_();
      },
      function(cb_) {
        my.module_manager.init(function(err) {
          if(err) {
            return cb_(err);
          }
          my.module_manager.install_module({
            module_id: 'breach/mod_test',
            version: '0.0.2'
          }, function(err) {
            if(err) {
              factory.log().error(err);
            }
            else {
              factory.log().out('INTSALL DONE');
            }
          });
        });
      }
    ], cb_);
  };

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
        size: [initial_pos[2] || 400, initial_pos[3] || 300]
      });
      popup.add_page(frame, function() {
        popup.show_page(frame);
      });
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

    /*TODO(spolu): Handle other disposition not handled by the stack. */
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
    /* TODO(spolu): Kill modules. */
    that.emit('kill');
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### kill
  //
  // Kills this session as well as the underlying exo_browser
  kill = function() {
    /* This will trigger the chain of kill events so we don't need to do much */
    /* more here.                                                             */
    my.exo_browser.kill();
  };

  
  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.getter(that, 'base_url', my, 'base_url');
  common.getter(that, 'off_the_record', my, 'off_the_record');
  common.getter(that, 'data_path', my, 'data_path');
  common.getter(that, 'session_id', my, 'session_id');

  common.getter(that, 'exo_browser', my, 'exo_browser');
  common.getter(that, 'exo_session', my, 'exo_session');

  return that;
};

exports.session = session;
