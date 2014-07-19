/*
 * Breach: core_store.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-18 spolu   Creation
 */
"use strict"

var common = require('./common.js');
var async = require('async');
var api = require('exo_browser');
var vm = require('vm');

// ## core_store
//
// Breach `core` module store implementation.
//
// The `core_store` object is in charge of exposing data storage capabilities to
// the modules. It relies on the session gigfs `module` channel. The module name 
// is prepended to any path used by a module.
//
// ```
// @spec { core_module, session }
// @inherits {}
// ```
var core_store = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.core_module = spec.core_module;
  my.session = spec.session;


  //
  // #### _public_
  //
  var init;                      /* init(cb_); */
  var kill;                      /* kill(cb_); */

  var store_register;            /* store_register(src, args, cb_); */
  var store_get;                 /* store_get(src, args, cb_); */
  var store_push;                /* store_push(src, args, cb_); */

  //
  // #### _private_
  //

  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/

  /****************************************************************************/
  /* EXPOSED PROCEDURES */
  /****************************************************************************/
  // ### store_register
  //
  // Registers a new type for the calling module. The type is prepended with the
  // module name so that type do not conflict across modules.
  //
  // Additionally we're running untrusted code coming from the modules here but 
  // as the modules have full access to the system for now, this does not really
  // matter. The code is nonetheless encapsulated in a `vm` as of now.
  // /* TODO(spolu): Check/Elaborate security model here */
  // ```
  // @src  {string} the source module
  // @args {object} { type, reduce } reduce is the code of the reduce function
  // @cb_  {function(err, res)}
  // ```
  store_register = function(src, args, cb_) {
    if(typeof args.type !== 'string') {
      return cb_(common.err('Invalid `type`: ' + args.type,
                            'core_store:invalid_type'));
    }
    if(typeof args.reduce !== 'string') {
      return cb_(common.err('Invalid `reduce`: ' + args.reduce,
                            'core_store:invalid_reduce'));
    }

    var type = 'modules:' + src + ':' + args.type;

    my.session.gig().register(type, function(oplog) {
      var sandbox = { oplog: oplog };
      var code = 'value = (' + args.reduce + ')(oplog);';
      vm.runInNewContext(code, sandbox);
      return sandbox.value || null;
    });

    return cb_();
  };

  // ### store_get
  //
  // Retrieves the value for the given type and path for the calling module. The
  // registered reducer provided by the module is used to compute the value.
  // ```
  // @src  {string} the source module
  // @args {object} { type, path } the type and path to retrieve
  // @cb_  {function(err, res)}
  // ```
  store_get = function(src, args, cb_) {
    if(typeof args.type !== 'string') {
      return cb_(common.err('Invalid `type`: ' + args.type,
                            'core_store:invalid_type'));
    }
    if(typeof args.path !== 'string') {
      return cb_(common.err('Invalid `path`: ' + args.path,
                            'core_store:invalid_path'));
    }

    var type = 'modules:' + src + ':' + args.type;
    var path = require('path').join(my.session.session_id(), src, args.path);

    my.session.gig().get('modules', type, path, cb_);
  };

  // ### store_push
  //
  // Pushes a new payload on the gigfs oplog associated with this type and path.
  // ```
  // @src  {string} the source module
  // @args {object} { type, path, payload } the type, path and payload to push
  // @cb_  {function(err, res)}
  // ```
  store_push = function(src, args, cb_) {
    if(typeof args.type !== 'string') {
      return cb_(common.err('Invalid `type`: ' + args.type,
                            'core_store:invalid_type'));
    }
    if(typeof args.path !== 'string') {
      return cb_(common.err('Invalid `path`: ' + args.path,
                            'core_store:invalid_path'));
    }

    var type = 'modules:' + src + ':' + args.type;
    var path = require('path').join(my.session.session_id(), src, args.path);
    var payload = args.payload || null;

    my.session.gig().push('modules', type, path, payload, cb_);
  };

  /****************************************************************************/
  /* INITIALIZATION */
  /****************************************************************************/
  // ### init
  // 
  // Initializes the core store module
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    return cb_();
  };

  // ### kill
  //
  // Kills the core store module
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  kill = function(cb_) {
    /* TODO(spolu): unregister types. */
    return cb_();
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'store_register', store_register, _super);
  common.method(that, 'store_get', store_get, _super);
  common.method(that, 'store_push', store_push, _super);

  return that;
};

exports.core_store = core_store;
