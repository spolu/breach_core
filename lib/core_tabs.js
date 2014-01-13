/*
 * Breach: core_tabs.js
 *
 * (c) Copyright Stanislas Polu 2014. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-01-13 spolu   Creation
 */
var common = require('./common.js');

// ## core_module
//
// Breach `core` module tabs implementation.
//
// The `core_tabs` object is in charge of tracking tabs state and exposing the 
// `tabs` API to other modules.
//
// ```
// @spec { core_module }
// @inherits {}
// ```
var core_tabs = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.core_module = spec.core_module;

  my.tabs = {};

  //
  // #### _public_
  //
  var init;                     /* init(cb_); */
  var kill;                     /* kill(cb_); */

  var tabs_new;                 /* tabs_new(args, cb_); */
  var tabs_close;               /* tabs_close(args, cb_); */
  var tabs_tag;                 /* tabs_tag(args, cb_); */
  var tabs_untag;               /* tabs_untag(args, cb_); */
  var tabs_get;                 /* tabs_get(args, cb_); */

  //
  // #### _private_
  //
  var frame_navigation_state;   /* frame_navigation_state(frame, state); */
  var frame_favicon_update;     /* frame_favicon_update(frame, favicons); */
  var frame_loading_start;      /* frame_loading_start(frame); */
  var frame_loading_stop;       /* frame_loading_stop(frame); */
  var browser_frame_created;    /* browser_frame_created(frame, disp, origin); */
  var browser_open_url;         /* browser_open_url(frame, disp, origin); */


  //
  // #### _that_
  //
  var that = {};

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

      // var entry = p.state.entries[p.state.entries.length - 1];
      // console.log('ENTRY [' + entry.id + ']: ' + entry.url.href);

      /* We send the event only if it's about the active page, otherwise it */
      /* should be confined to the stack state.                             */
      if(new_id !== old_id && new_id !== null) {
        that.emit('navigation_state', p, true);
      }
      else if(new_href !== old_href && new_href != null) {
        that.emit('navigation_state', p, false);
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

  // ### frame_loading_start
  //
  // One frame started loading so we should update our internal state and emit
  // an event if the frame is visible
  // ```
  // @frame    {exo_frame} the target frame
  // ```
  frame_loading_start = function(frame) {
    var p = page_for_frame(frame);
    if(p) {
      p.loading = true;
      push();
      if(my.pages[my.active] === p) {
        that.emit('loading_start');
      }
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
    var p = page_for_frame(frame);
    if(p) {
      p.loading = false;
      push();
      if(my.pages[my.active] === p) {
        that.emit('loading_stop');
      }
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
      }
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
        url: url,
        session: my.session.exo_session()
      }),
      state: { 
        entries: [],
        can_go_back: false,
        can_go_forward: false
      }
    };

    insert_page(p, disposition === 'new_background_tab', function() {
      p.frame.focus();
    });
    push();
  };


  /****************************************************************************/
  /* EXPOSED PROCEDURES */
  /****************************************************************************/
  // ### tabs_new
  //
  // Creates a new tab and navigate to the specified URL.
  // ```
  // @args {object} { [url] }
  // @cb_  {function(err, res)}
  // ```
  tabs_new = function(args, cb_) {
  };

  // ### tabs_close
  //
  // Closes a tab by id.
  // ```
  // @args {object} { id }
  // @cb_  {function(err, res)}
  // ```
  tabs_close = function(args, cb_) {
  };

  // ### tabs_tag
  //
  // Adds a tag to a tab by id
  // ```
  // @args {object} { id, tag }
  // @cb_  {function(err, res)}
  // ```
  tabs_tag = function(args, cb_) {
  };

  // ### tabs_untag
  //
  // Removes a tag from a tab by id
  // ```
  // @args {object} { id, tag }
  // @cb_  {function(err, res)}
  // ```
  tabs_untag = function(args, cb_) {
  };

  // ### tabs_get
  //
  // Retrieves the opened tabs
  // ```
  // @args {object} { id, tag }
  // @cb_  {function(err, res)}
  // ```
  tabs_get = function(args, cb_) {
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
    my.core_module.get_exo_browser().on('frame_favicon_update', frame_favicon_update);
    my.core_module.get_exo_browser().on('frame_loading_start', frame_loading_start);
    my.core_module.get_exo_browser().on('frame_loading_stop', frame_loading_stop);
    my.core_module.get_exo_browser().on('frame_created', browser_frame_created);
    my.core_module.get_exo_browser().on('open_url', browser_open_url);
    my.core_module.get_exo_browser().on('frame_navigation_state', frame_navigation_state);
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'tabs_new', tabs_new, _super);
  common.method(that, 'tabs_close', tabs_close, _super);
  common.method(that, 'tabs_tag', tabs_tag, _super);
  common.method(that, 'tabs_untag', tabs_untag, _super);
  common.method(that, 'tabs_get', tabs_get, _super);

  return that;
};

exports.core_tabs = core_tabs;
