/*
 * Breach: session.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-10-14 spolu   Creation
 */

var events = require('events');
var common = require('./common.js');
var api = require('exo_browser');
var path = require('path');
var factory = common.factory;

// ## cookie_store
//
// We use the creation_date field to uniquely identify a cookie. This is
// inspired by content's SQLite persistent cookie store.
//
// Cookie format:
//  {
//    "source": "http://www.google.com/",
//    "name": "OGPC",
//    "value": "4061029-1:",
//    "domain": ".google.com",
//    "path": "/",
//    "creation": 13026210599653482,
//    "expiry": 13026296999000000,
//    "last_access": 13026210599653482,
//    "secure": false,
//    "http_only": false,
//    "priority": 1,
//    "_id": "WX38vz0rYb4c5Ir9"
//  }
//
//
// ```
// @spec { session }
// ```
var cookie_store = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.session = spec.session || api.default_session();
  my.path = my.session.off_the_record() ? null : 
    path.join(my.session.path(), 'cookies.db');
  my.db = factory.db(my.path);

  my.db.ensureIndex({ fieldName: 'creation', unique: true });
  my.db.ensureIndex({ fieldName: 'domain' });

  //
  // #### _public_
  //
  var load_for_key;               /* load_for_key(key, cb_(cookies)); */
  var flush;                      /* flush(cb_()); */
  var add;                        /* add(cc); */
  var remove;                     /* remove(cc); */
  var update_access_time;         /* update_access_time(cc); */
  var force_keep_session_state;   /* force_keep_session_state(); */

  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  // ### load_for_key
  //
  // Loads the cookies for the given key (all cookies if null)
  // ```
  // @key {string} the key to use
  // @cb_ {function(cookies)} the callback
  // ```
  load_for_key = function(key, cb_) {
    var query = {};
    if(typeof key === 'string') query.domain = key;

    my.db.find(query, function(err, ccs) {
      if(err) {
        factory.log().error(err);
        return cb_([]);
      }
      else {
        factory.log().debug('COOKIE LOAD_FOR_KEY: ' + key + 
                          ' [' + typeof key + ']');
        factory.log().debug(JSON.stringify(ccs, null, 2));
        return cb_(ccs);
      }
    });
  };

  // ### flush
  //
  // Flushes the cookies to persistent storage
  // ```
  // @cb_ {function()} the callback
  // ```
  flush = function(cb_) {
    /* TODO(spolu): Check if NeDB has a command for that? Otherwise nothing */
    /*              to do here as data is already peristed.                 */
    return cb_();
  };

  // ### add
  //
  // Adds a new cookie to store
  // ```
  // @cc {object} the cookie to add
  // ```
  add = function(cc) {
    my.db.insert(cc, function(err) {
      if(err)
        factory.log().error(err);
      else {
        factory.log().debug('COOKIE ADDED: ');
        factory.log().debug(JSON.stringify(cc, null, 2));
      }
    });
  };

  // ### remove
  //
  // Removes a cookie from to store
  // ```
  // @cc {object} the cookie to remove
  // ```
  remove = function(cc) {
    my.db.remove({ 
      creation: cc.creation 
    }, {
      multi: true
    }, function(err) {
      if(err)
        factory.log().error(err);
      else {
        factory.log().debug('COOKIE REMOVED: ');
        factory.log().debug(JSON.stringify(cc, null, 2));
      }
    });
  };

  // ### update_access_time
  //
  // Update the access time of the specified cookie
  // ```
  // @cc {object} the cookie to update
  // ```
  update_access_time = function(cc) {
    my.db.update({ 
      creation: cc.creation 
    }, {
      $set: { last_access: (Date.now() * 1000) }
    }, {
      multi: true
    }, function(err) {
      if(err)
        factory.log().error(err);
      else {
        factory.log().out('COOKIE ACCESS TIME UPDATED: ');
        factory.log().out(JSON.stringify(cc, null, 2));
      }
    });
  };

  // ### force_keep_session_state
  //
  // Instructs the store not to discard session only cookies on shutdown
  force_keep_session_state = function() {
    /* TODO(spolu): Implement later on. We log it for now. */
    factory.log().out('COOKIE: `force_keep_session_state`');
  };

  /* Finally we register the handlers in the session. */
  my.session.set_cookie_handlers({
    load_for_key: load_for_key,
    flush: flush,
    add: add,
    remove: remove,
    update_access_time: update_access_time,
    force_keep_session_state: force_keep_session_state
  });

  return that;
};

exports.cookie_store = cookie_store;
