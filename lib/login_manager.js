/*
 * Breach: login_manager.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2014-04-18 spolu   Creation
 */
"use strict"

var express = require('express');
var events = require('events');
var async = require('async');
var http = require('http');
var request = require('request');

var common = require('./common.js');
var api = require('exo_browser');

// ## login_manager
//
// The login_manager is in charge of managing the authentication of users on
// the current device.
//
// For now, it simply requires a table_url and master let the user open a 
// default session (running with off_the_record = false)
//
// It therefore displays an out-of-session exo_browser window that communicates
// with a local express server. When closed, all sessions are closed and
// Breach is exited.
//
// ```
// @spec { }
// ```
var login_manager = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.app = null;
  my.base_url = null;

  //
  // _public_
  //
  var init;                /* init(cb_); */
  var kill;                /* kill(cb_); */

  //
  // _private_
  //
  var post_session_credentials;   /* post_session_credentials(req, res, next); */
  
  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### post_session_credentials
  //
  // Express route to post the credentials to use
  // ```
  // GET /session/credentials
  // ```
  post_session_credentials = function(req, res, next) {
    if(!req.body.table_url ||
       !req.body.master) {
      return next(common.err('Invalid Credentials',
                             'login_manager:invalid_credentials'));
    }
    var timeout = 60 * 60 * 1000;
    var table_url = req.body.table_url;
    var master = req.body.master;
    var session_token = '';
    var sessions = null;

    async.series([
      function(cb_) {
        var t_url = table_url + 'session/new' + 
          '?master=' + master + '&timeout=' + timeout;
        request(t_url, { json: true }, function(err, res, json) {
          if(err) {
            return cb_(err);
          }
          if(!json || !json.session_token) {
            return cb_(common.err('Impossible to retrieve `session_token`',
                                  'index:impossible_session_token'));
          }
          else {
            session_token = json.session_token;
            return cb_();
          }
        });
      },
      function(cb_) {
        if(my.session_manager) {
          delete my.session;
          my.session_manager.kill(cb_);
        }
        return cb_();
      },
      function(cb_) {
        my.session_manager = require('./session_manager.js').session_manager({
          table_url: table_url,
          session_token: session_token,
          off_the_record: false
        });
        my.session_manager.init(cb_);
      },
      function(cb_) {
        my.session_manager.list_sessions(function(err, json) {
          if(err) {
            return cb_(err);
          }
          sessions = json;
          return cb_();
        });
      },
      function(cb_) {
        if(Object.keys(sessions).length === 0) {
          my.session_manager.new_session(false, 'Test Session', function(err, session) {
            if(err) {
              return cb_(err);
            }
            return cb_();
          });
        }
        else {
          my.session_manager.open_session(Object.keys(sessions)[0], function(err, session) {
            if(err) {
              return cb_(err);
            }
            return cb_();
          });
        }
      }
    ], function(err) {
      if(err) {
        return next(err);
      }
      return res.json({ ok: true });
    });
  };


  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### init
  // 
  // Initialializes the session manager
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    my.app = express();
    my.app.use('/', express.static(__dirname + '/../static'));
    my.app.use(require('body-parser')());
    my.app.use(require('method-override')())

    my.app.post('/session/credentials', post_session_credentials);

    async.series([
      function(cb_) {
        my.http_srv = http.createServer(my.app).listen(0, '127.0.0.1');
        my.http_srv.on('listening', function() {
          my.port = my.http_srv.address().port;
          my.base_url = 'http://127.0.0.1:' + my.port + '/';
          common.log.out('[login_manager] HTTP Server started on `' + my.base_url + '`');
          return cb_();
        });
      },
      function(cb_) {
        my.exo_browser = api.exo_browser({
          size: [600, 400],
          icon_path: require('path').join(__dirname, '../breach.png')
        });
        my.exo_browser.set_title('Breach::LoginManager');
        my.exo_browser.focus();

        my.exo_browser.on('kill', kill);

        return cb_();
      },
      function(cb_) {
        /* Display `login_manager` page. */
        my.login_frame = api.exo_frame({
          name: my.exo_browser.name() + '_login',
          url: my.base_url + 'login',
        });
        async.series([
          function(cb_) {
            my.exo_browser.add_page(my.login_frame, cb_);
          },
          function(cb_) {
            my.exo_browser.show_page(my.login_frame, cb_);
          }
        ], cb_);
      }
    ], cb_);
  };

  // ### kill
  //
  // Stops and destroys the session_manager
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  kill = function(cb_) {
    common.log.out('[login_manager] KILL');
    my.http_srv.close(cb_);
    process.exit(0);
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.login_manager = login_manager;
