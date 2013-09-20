/*
 * ExoBrowser: api.js
 * 
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-12 spolu   Add name to browser
 * 2013-08-11 spolu   Creation
 */

var common = require('./common.js');
var events = require('events');
var async = require('async');

var _exo_browser = apiDispatcher.requireExoBrowser();
var factory = common.factory;

exports.NOTYPE_FRAME = 0;
exports.CONTROL_FRAME = 1;
exports.PAGE_FRAME = 2;

exports.frame_count = 0;

// ## exo_frame
//
// Wrapper around the internal API representation of an ExoFrame. It alos serves
// as a proxy on the internal state of the ExoFrame.
//
// ExoFrames are named objects. Their names are expected to be uniques. If no
// name is specifed a statically incremented counter is used to provide a unique
// human readable name.
//
// The `url` argument is expected.
// ```
// @spec { url, [name] | internal }
// ```
var exo_frame = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.internal = spec.internal || null;

  my.url = spec.url || '';
  my.name = spec.name || ('fr-' + (exports.frame_count++));
  my.visible = false;
  my.ready = false;
  my.parent = null;
  my.type = exports.NOTYPE_FRAME;
  my.loading = 0;
  my.title = '';

  my.find_rid = 0;
  my.find = {};

  //
  // #### _public_
  //
  var load_url;            /* load_url(url, [cb_]); */
  var go_back_or_forward;  /* go_back_or_forward(offset, [cb_]); */
  var reload;              /* reload([cb_]); */
  var stop;                /* stop([cb_]); */ 
  var focus;               /* focus([cb_]); */
  var find;                /* find(text, forward, case, next, [cb_]); */
  var find_stop;           /* find_stop(action, [cb_]); */

  var kill;                /* kill(); */

  //
  // #### _private_
  //
  var init;     /* init(); */
  var pre;      /* pre(cb_); */

  //
  // #### _that_
  //
  var that = new events.EventEmitter();


  // ### pre
  //
  // Takes care of the syncronization. If the frame is not yet ready it will
  // wait on the `ready` event.
  // ```
  // @cb_ {function(err)}
  // ```
  pre = function(cb_) {
    if(my.killed) {
      return cb_(new Error('Frame was killed: ' + my.name));
    }
    if(!my.ready) {
      that.on('ready', function() {
        return cb_();
      });
    }
    else {
      return cb_();
    }
  };

  // ### load_url
  //
  // Loads the specified url within this frame.
  // ```
  // @url {string} the url to load
  // @cb_ {function(err)} [optional]
  load_url = function(url, cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._loadURL(url, function() {
          /* TODO(spolu): Figure out if we change the URL here or from the */
          /* browser on `frame_navigate` event?                            */
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### go_back_or_forward
  //
  // Goes back or forward in history for that frame
  // ```
  // @offset {number} where we go in history
  // @cb_    {functio(err)}
  // ```
  go_back_or_forward = function(offset, cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._goBackOrForward(offset, function() {
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### reload
  //
  // Reloads the frame
  // ```
  // @cb_    {functio(err)}
  // ```
  reload = function(cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._reload(function() {
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### stop
  //
  // Stops the frame
  // ```
  // @cb_    {functio(err)}
  // ```
  stop = function(cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._stop(function() {
          if(cb_) return cb_();
        });
      }
    });
  };


  // ### focus
  //
  // Focuses the frame
  // ```
  // @cb_    {functio(err)}
  // ```
  focus = function(cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._focus(function() {
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### find
  //
  // Find text in frame html
  // ```
  // @text      {string} the search test
  // @forward   {boolean} search forward (backward otherwise)
  // @sensitive {boolean} case sensitive (insensitive otherwise)
  // @next      {boolean} followup request (first one otherwise)
  // @cb_       {functio(err)}
  // ```
  find = function(text, forward, sensitive, next, cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        var rid = next ? my.find[text] : ++my.find_rid;
        my.find[text] = rid;
        my.internal._find(rid, text, forward, sensitive, next, function() {
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### find_stop
  //
  // Stop finding in frame html
  // ```
  // @action {string} the stop find action type ('clear'|'keep'|'activate')
  find_stop = function(action, cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._stopFinding(action, function() {
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### kill
  //
  // Deletes the internal exo frame to let the object get GCed
  // ```
  // @cb_    {functio(err)}
  // ```
  kill = function(cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.killed = true;
        my.ready = false;
        delete my.internal;
        that.removeAllListeners();
      }
    });
  };


  // ### init
  //
  // Runs initialization procedure.
  init = function() {
    var finish = function() {
      my.internal._setFaviconUpdateCallback(function(favicons) {
        if(my.parent) {
          my.parent.emit('frame_favicon_update', that, favicons);
        }
      });
      my.internal._setLoadFailCallback(function(url, error_code, error_desc) {
        if(my.parent) {
          my.parent.emit('frame_load_fail', that, url, error_code, error_desc);
        }
      });
      my.internal._setLoadFinishCallback(function(url) {
        if(my.parent) {
          my.parent.emit('frame_load_finish', that, url);
        }
      });
      my.internal._setLoadingStartCallback(function() {
        if(my.parent) {
          my.loading++;
          my.parent.emit('frame_loading_start', that);
        }
      });
      my.internal._setLoadingStopCallback(function() {
        if(my.parent) {
          my.loading--;
          my.parent.emit('frame_loading_stop', that);
        }
      });

      my.ready = true;
      that.emit('ready');
    };

    if(my.internal) {
      my.internal._name(function(name) {
        my.name = name;
        return finish();
      });
    }
    else {
      _exo_browser._createExoFrame({
        name: my.name,
        url: my.url
      }, function(f) {
        my.internal = f;
        return finish();
      });
    }
  };


  init();

  common.method(that, 'pre', pre, _super);
  common.method(that, 'load_url', load_url, _super);
  common.method(that, 'go_back_or_forward', go_back_or_forward, _super);
  common.method(that, 'reload', reload, _super);
  common.method(that, 'stop', stop, _super);
  common.method(that, 'focus', focus, _super);
  common.method(that, 'find', find, _super);
  common.method(that, 'find_stop', find_stop, _super);
  common.method(that, 'kill', kill, _super);

  common.getter(that, 'url', my, 'url');
  common.getter(that, 'name', my, 'name');
  common.getter(that, 'visible', my, 'visible');
  common.getter(that, 'ready', my, 'ready');
  common.getter(that, 'parent', my, 'parent');
  common.getter(that, 'type', my, 'type');
  common.getter(that, 'loading', my, 'loading');
  common.getter(that, 'title', my, 'title');

  /* Should only be called by exo_browser. */
  common.getter(that, 'internal', my, 'internal');

  common.setter(that, 'url', my, 'url');
  common.setter(that, 'name', my, 'name');
  common.setter(that, 'visible', my, 'visible');
  common.setter(that, 'ready', my, 'ready');
  common.setter(that, 'parent', my, 'parent');
  common.setter(that, 'type', my, 'type');
  common.setter(that, 'title', my, 'title');

  common.method(that, 'pre', pre, _super);

  return that;
};

exports.exo_frame = exo_frame;


exports._exo_browsers = {};
exports.exo_browser = function(name) {
  return exports._exo_browsers[name] || null;
};

exports.TOP_CONTROL = 1;
exports.BOTTOM_CONTROL = 2;
exports.LEFT_CONTROL = 3;
exports.RIGHT_CONTROL = 4;

exports.browser_count = 0;


// ## exo_browser
//
// Wrapper around the internal API representation of an ExoBrowser. It also
// serves as a proxy on the internal state of the ExoBrowser, event broker
// for all events related to it (its and the ones from the frames attached to
// it) and takes care of some synchronization to provided an facilitated use / 
// syntax. In particular it makes sure that all objects that are alive (not 
// killed) are not garbage collected.
//
// ExoFrames are named objects. Their names are expected to be uniques. If no
// name is specifed a statically incremented counter is used to provide a unique
// human readable name.
// ```
// @spec { size, [name] }
// ```
var exo_browser = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.internal = null;

  my.ready = false;
  my.killed = false;
  my.size = spec.size || [800, 600];
  my.name = spec.name || ('br-' + (exports.frame_count++));

  my.frames = {};
  my.pages = {};

  my.controls = {};
  my.controls[exports.TOP_CONTROL] = null;
  my.controls[exports.BOTTOM_CONTROL] = null;
  my.controls[exports.LEFT_CONTROL] = null;
  my.controls[exports.RIGHT_CONTROL] = null;

  my.control_dimensions = {};
  my.control_dimensions[exports.TOP_CONTROL] = 0;
  my.control_dimensions[exports.BOTTOM_CONTROL] = 0;
  my.control_dimensions[exports.LEFT_CONTROL] = 0;
  my.control_dimensions[exports.RIGHT_CONTROL] = 0;


  //
  // #### _public_
  //
  var kill;                  /* kill([cb_]); */
  var focus;                 /* focus([cb_]); */
  var maximize;              /* maximize([cb_]); */

  var set_control;           /* set_control(type, frame, [cb_]); */
  var unset_control;         /* unset_control(type, [cb_]); */
  var set_control_dimension; /* set_control_dimension(type, size, [cb_]); */

  var add_page;              /* add_page(frame, [cb_]); */
  var remove_page;           /* remove_page(frame, [cb_]); */
  var show_page;             /* show_page(frame, [cb_]); */

  //
  // #### _private_
  //
  var init;     /* init(); */
  var pre;      /* pre(cb_); */

  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  // ### pre
  //
  // Takes care of the syncronization. If the browser is not yet ready it will
  // wait on the `ready` event. If the browser is killed it will return an error
  // ```
  // @cb_ {function(err)}
  // ```
  pre = function(cb_) {
    if(my.killed)
      return cb_(new Error('Browser already killed: ' + my.name));
    else if(!my.ready) {
      that.on('ready', function() {
        return cb_();
      });
    }
    else {
      return cb_();
    }
  };

  // ### set_control
  //
  // Adds the specified as a control for the given type
  // ```
  // @type  {control_type} the type (see exports constants)
  // @frame {exo_frame} the frame to set as control
  // @cb_   {function(err)} [optional]
  // ```
  set_control = function(type, frame, cb_) {
    /* We take care of "synchronization" */
    async.parallel([ pre, frame.pre ], function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._setControl(type, frame.internal(), function() {
          frame.set_parent(that);
          frame.set_type(exports.CONTROL_TYPE);
          my.frames[frame.name()] = frame;
          my.controls[type] = frame;
          if(my.control_dimensions[type] === 0) {
            my.controls[type].set_visible(false);
          }
          else {
            my.controls[type].set_visible(true);
          }
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### unset_control
  //
  // Unsets the control specified by type (returns its frame if it was set)
  // ```
  // @type  {control_type} the type (see exports constants)
  // @cb_   {function(err, frame)} [optional]
  // ```
  unset_control = function(type, cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._unsetControl(type, function() {
          var control = my.controls[type];
          control.set_parent(that);
          control.set_type(exports.NO_TYPE);
          control.set_visible(false);
          my.controls[type] = null;
          my.control_dimensions[type] = 0;
          delete my.frames[control.name()];
          if(cb_) return cb_(null, control);
        });
      }
    });
  };

  // ### set_control_dimension
  //
  // Sets the given size as pixels as canonical dimension for the control
  // ```
  // @type  {Number} the type (see exports contants)
  // @size  {Number} the size in pixels
  // @cb_   {function(err, frame)} [optional]
  // ```
  set_control_dimension = function(type, size, cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._setControlDimension(type, size, function() {
          my.control_dimensions[type] = size;
          if(my.control_dimensions[type] === 0) {
            my.controls[type].set_visible(false);
          }
          else {
            my.controls[type].set_visible(true);
          }
          if(cb_) return cb_(null, my.controls[type]);
        });
      }
    });
  };

  // ### add_page
  //
  // Adds a page to the browser. The visible page is not altered by this method
  // ```
  // @frame {exo_frame} the frame to add as a page
  // @cb_   {funciton(err)
  // ```
  add_page = function(frame, cb_) {
    /* We take care of "synchronization" */
    async.parallel([ pre, frame.pre ], function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._addPage(frame.internal(), function() {
          frame.set_parent(that);
          frame.set_type(exports.PAGE_TYPE);
          my.pages[frame.name()] = frame;
          my.frames[frame.name()] = frame;
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### remove_page
  //
  // Removes the specified page
  // ```
  // @frame {exo_frame} the frame to add as a page
  // @cb_   {funciton(err)
  // ```
  remove_page = function(frame, cb_) {
    /* We take care of "synchronization" */
    async.parallel([ pre, frame.pre ], function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        if(my.frames[frame.name()] !== frame) {
          return cb_(new Error('Frame not known: ' + frame.name()));
        }
        my.internal._removePage(frame.name(), function() {
          frame.set_visible(false);
          frame.set_parent(null);
          frame.set_type(exports.NO_TYPE);
          delete my.pages[frame.name()];
          delete my.frames[frame.name()];
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### show_page
  //
  // Shows the provided page in the browser.
  // ```
  // @frame {exo_frame} the frame to add as a page
  // @cb_   {funciton(err)
  // ```
  show_page = function(frame, cb_) {
    /* We take care of "synchronization" */
    async.parallel([ pre, frame.pre ], function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        if(my.frames[frame.name()] !== frame) {
          return cb_(new Error('Frame not known: ' + frame.name()));
        }
        my.internal._showPage(frame.name(), function() {
          for(var name in my.pages) {
            if(my.pages.hasOwnProperty(name)) {
              my.pages[name].set_visible(false);
            }
          }
          frame.set_visible(true);
          if(cb_) return cb_();
        });
      }
    });
  };


  // ### kill
  //
  // Kills the browser, removes it from the internal registry and deletes its
  // internal representation so that the native objects get deleted.
  // ```
  // @cb_ {function(err)} [optional]
  // ```
  kill = function(cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        /* The `Kill` Callback is going to be called so we should not do  */
        /* anything here, esp. as `KIll` can be called internally (window */
        /* closed).                                                       */
        my.internal._kill(function() {
          if(cb_) return cb_();
        });
      }
    });
  };

  
  // ### focus
  // 
  // Attempts to focus on the browser window depending on what the native
  // platform lets us do.
  // ```
  // @cb_ {function(err)} [optional]
  // ```
  focus = function(cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._focus(function() {
          if(cb_) return cb_();
        });
      }
    });
  };

  // ### maximize
  // 
  // Attempts to maximize the browser window depending on what the native 
  // platform lets us do.
  // ```
  // @cb_ {function(err)} [optional]
  // ```
  maximize = function(cb_) {
    pre(function(err) {
      if(err) {
        if(cb_) return cb_(err);
      }
      else {
        my.internal._maximize(function() {
          if(cb_) return cb_();
        });
      }
    });
  };




  // ### init
  //
  // Runs initialization procedure and adds itself to the internal registry.
  init = function() {
    _exo_browser._createExoBrowser({
      size: my.size
    }, function(b) {
      my.internal = b;
      exports._exo_browsers[my.name] = that;

      my.internal._setOpenURLCallback(function(url, disposition, from) {
        var origin = my.frames[from] || null;
        that.emit('open_url', url, disposition, origin);
      });
      my.internal._setResizeCallback(function(size) {
        my.size = size;
        that.emit('resize', size);
      });
      my.internal._setKillCallback(function() {
        /* `Kill` has been called from here or somewhere else so let's make */
        /* sure we have eveything cleaned up */
        for(var name in my.frames) {
          if(my.frames.hasOwnProperty(name)) {
            my.frames[name].kill();
          }
        }
        my.controls[exports.TOP_CONTROL] = null;
        my.controls[exports.BOTTOM_CONTROL] = null;
        my.controls[exports.LEFT_CONTROL] = null;
        my.controls[exports.RIGHT_CONTROL] = null;
        my.frames = {};
        my.pages = {};

        delete my.internal;
        my.killed = true;
        my.ready = false;
        delete my.internal;
        delete exports._exo_browsers[my.name];
        that.emit('kill');
      });
      my.internal._setFrameCloseCallback(function(from) {
        that.emit('frame_close', my.frames[from]);
      });
      my.internal._setFrameCreatedCallback(function(_frame, disposition, 
                                                    initial_pos, from) {
        var origin = my.frames[from] || null;
        var frame = exo_frame({ internal: _frame });
        frame.on('ready', function() {
          that.emit('frame_created', frame, disposition, initial_pos, origin);
          console.log(frame.name() + ': ' + disposition + 
                      ' ' + initial_pos + ' [' + origin.name() + ']');
        });
      });
      my.internal._setFrameKeyboardCallback(function(from, event) {
        that.emit('frame_keyboard', my.frames[from], event);
      });
      my.internal._setNavigationStateCallback(function(from, state) {
        //console.log(state);
        state.entries.forEach(function(e) {
          e.url = require('url').parse(e.virtual_url || '');
        });
        that.emit('frame_navigation_state', my.frames[from], state);
      });

      my.ready = true;
      that.emit('ready');
    });
  };


  init();
  
  common.getter(that, 'name', my, 'name');
  common.getter(that, 'ready', my, 'ready');
  common.getter(that, 'killed', my, 'killed');
  common.getter(that, 'internal', my, 'internal');
  common.getter(that, 'size', my, 'size');
  common.getter(that, 'frames', my, 'frames');
  common.getter(that, 'controls', my, 'controls');
  common.getter(that, 'pages', my, 'pages');

  common.method(that, 'kill', kill, _super);

  common.method(that, 'set_control', set_control, _super);
  common.method(that, 'unset_control', unset_control, _super);
  common.method(that, 'set_control_dimension', set_control_dimension, _super);

  common.method(that, 'add_page', add_page, _super);
  common.method(that, 'remove_page', remove_page, _super);
  common.method(that, 'show_page', show_page, _super);

  common.method(that, 'focus', focus, _super);
  common.method(that, 'maximize', maximize, _super);

  return that;
};

exports.exo_browser = exo_browser;

