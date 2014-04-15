/*
 * Breach: session_manager.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-04-11 spolu   Creation
 */
"use strict"

var events = require('events');
var async = require('async');

var common = require('./common.js');

// ## session_manager
//
// The session_manager is based on GiG.fs and lets the user retrieve its
// session from any computer. It also lets the user start private sessions
// that are not synchronized and do not leave any data locally.
//
// If the computer is trusted (the user computer), off_the_record can be set
// to false to let the Content API cache content locally.
//
// The session manager takes three arguments:
// - `table_url` the GiG.fs table_url to use
// - `session_token` the GiG.fs session token to use
// - `off_the_record` wether this computer is trusted for local caching
//
// ```
// @spec { table_url, session_token, off_the_record }
// ```
var session_manager = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.session_salt = 0;

  my.table_url = spec.table_url;
  my.session_token = spec.session_token;
  my.off_the_record = (typeof spec.off_the_record === 'undefined' ? 
                         true : spec.off_the_record);

  /* { session_id : { session_id,    */
  /*                  name,          */
  /*                  private,       */
  /*                  session } }    */
  my.sessions = {};
  my.gig = null;

  //
  // _public_
  //
  var list_sessions;    /* list_sessions(cb_); */
  var open_session;     /* open_session(session_id, cb_); */
  var close_session;    /* close_session(session_id, cb_); */
  var new_session;      /* new_session(private, name, cb_); */
  var destroy_session;  /* destroy_session(session_id, cb_); */

  var init;             /* init(cb_); */
  var kill;             /* kill(cb_); */

  //
  // _private_
  //
  var next_session_id;  /* next_session_id(); */

  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### next_session_id
  //
  // Returns a freshly computed "kindof" unique session_id
  next_session_id = function() {
    return common.hash([
      my.session_token,
      ++my.session_salt,
      Date.now()
    ]).substr(0, 20);
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### list_sessions
  // 
  // Lists all the sessions, running or idle accessible through gig.fs
  // ```
  // @cb_ {function(err, sessions)}
  // ```
  list_sessions = function(cb_) {
    my.gig.get('session', '/sessions', function(err, sessions) {
      if(err) {
        return cb_(err);
      }
      Object.keys(my.sessions).forEach(function(session_id) {
        if(sessions[session_id]) {
          sessions[session_id].running = true;
        }
        else {
          sessions[session_id] = {
            session_id: session_id,
            private: my.sessions[session_id].private || false,
            name: my.sessions[session_id].name,
            running: true
          }
        }
      });
      return cb_(null, sessions);
    });
  };

  // ### open_session
  //
  // Retrieves the session list, check that the session exists and opens it. It
  // returns the actual session object.
  // ```
  // @session_id {string} the session_id
  // @cb_        {function(err, session)}
  // ```
  open_session = function(session_id, cb_) {
    var session = null;
    async.series([
      function(cb_) {
        my.gig.get('session', '/sessions', function(err, sessions) {
          if(err) {
            return cb_(err);
          }
          if(!sessions[session_id]) {
            return cb_(common.err('Unknown `session_id`: ' + session_id,
                                  'session_manager:unknown_session_id'));
          }
          session = sessions[session_id];
          return cb_();
        });
      },
      function(cb_) {
        my.gig.push('session', '/sessions', {
          type: 'open',
          session_id: session_id
        }, cb_);
      },
      function(cb_) {
        my.sessions[session_id] = {
          session_id: session_id,
          private: false,
          name: session.name,
          session: require('./lib/session.js').session({
            session_id: session_id,
            gig: my.gig,
            off_the_record: my.off_the_record
          })
        };
        my.sessions[session_id].session.on('kill', function() {
          delete my.sessions[session_id];
        });
        return my.sessions[session_id].session.init(cb_);
      },
      function(cb_) {
        return my.sessions[session_id].session.run_modules(cb_);
      }
    ], function(err) {
      if(err) {
        return cb_(err);
      }
      return cb_(null, my.sessions[session_id].session);
    });
  };

  // ### close_session
  //
  // Closes the running session denoted by session_id
  // ```
  // @session_id {string} the session_id
  // @cb_        {function(err, session)}
  // ```
  close_session = function(session_id, cb_) {
    if(!my.sessions[session_id]) {
      return cb_(common.err('Unknown `session_id`: ' + session_id,
                            'session_manager:unknown_session_id'));
    }
    /* The object will get cleaned up by the handler on the `kill` event. */
    my.sessions[session_id].session.kill(cb_);
  };

  // ### new_session
  //
  // Creates a new session. This session can be private (not stored on GiG.fs)
  // and necessarily off_the_record with an in_memory GiG.fs client. Or if it's
  // not private, it's stored in the main GiG.fs.
  //
  // Creating a new session also opens it.
  // ```
  // @private {boolean} is the session private?
  // @name    {string}  the session name
  // @cb_     {function(err, session)}
  // ```
  new_session = function(private, name, cb_) {
    var session_id = next_session_id();
    if(private) {
      async.series([
        function(cb_) {
          my.sessions[session_id] = {
            session_id: session_id,
            private: true,
            session: require('./lib/session.js').session({
              session_id: session_id,
              gig: null,
              off_the_record: true
            })
          };
          return cb_();
        },
        function(cb_) {
          return my.sessions[session_id].session.init(cb_);
        },
        function(cb_) {
          return my.sessions[session_id].session.run_modules(cb_);
        }
      ], function(err) {
        if(err) {
          return cb_(err);
        }
        return cb_(null, my.sessions[session_id].session);
      });
    }
    else {
      async.series([
        function(cb_) {
          my.gig.push('session', '/sessions', {
            type: 'new',
            session_id: session_id,
            name: name || null
          }, cb_);
        },
      ], function(err) {
        if(err) {
          return cb_(err);
        }
        return open_session(session_id, cb_);
      });
    }
  };

  // ### destroy_session
  //
  // Destroys a session as well as all the data related to it.
  // 
  // ```
  // @session_id {string} the session_id
  // @cb_        {function(err)}
  // ```
  destroy_session = function(session_id, cb_) {
    var destroy = false;
    async.series([
      function(cb_) {
        if(my.sessions[session_id]) {
          close_session(session_id, cb_);
        }
        else {
          return cb_();
        }
      },
      function(cb_) {
        list_session(function(err, sessions) {
          if(err) {
            return cb_(err);
          }
          if(sessions[session_id]) {
            my.gig.push('session', '/sessions', {
              type: 'destroy',
              session_id: session_id,
            }, cb_);
          }
          else {
            return cb_();
          }
        });
      }
    /* TODO(spolu): all related data should also be destroyed (cookies, etc, */
    /*              ...) which will require some work (API on gig.fs?).      */
    ], cb_);
  };

  // ### init
  // 
  // Initialializes the session manager
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    /* In memory gigs are not accepted at initialization. An other static API */
    /* will be provided to open purely private session without "login".       */
    my.gig = require('gig.fs').gig({
      table_url: my.table_url,
      session_token: my.session_token
    });

    my.gig.register('session', function(oplog) {
      var value = null;
      oplog.forEach(function(op) {
        if(op.value) {
          value = op.value;
        }
        else if(op.payload) {
          switch(op.payload.type) {
            case 'new': {
              value[op.payload.session_id] = {
                session_id: op.payload.session_id,
                name: op.payload.name
              };
              break;
            }
            case 'open': {
              if(value[op.payload.session_id]) {
                value[op.payload.session_id].last_open = op.date;
              }
              break;
            }
            case 'destroy': {
              delete value[op.payload.session_id];
            }
            default: {
              break;
            }
          }
        }
      });
    });

    return my.gig.init(cb_);
  };

  // ### kill
  //
  // Stops and destroys the session_manager
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  kill = function(cb_) {
    async.series([
      function(cb_) {
        async.each(my.sessions, function(s, cb_) { 
          s.kill(cb_);
        });
      },
      function(cb_) {
        my.gig.kill(cb_);
      }
    ], cb_);
  };

  common.method(taht, 'list_sessions', list_sessions, _super);
  common.method(taht, 'open_session', open_sessions, _super);
  common.method(taht, 'close_session', close_sessions, _super);
  common.method(taht, 'new_session', new_sessions, _super);
  common.method(taht, 'destroy_session', destroy_sessions, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.session_manager = session_manager;
