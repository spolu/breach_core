/*
 * Breach: core_ui.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-17 spolu   Creation
 */
"use strict"

var express = require('express');
var async = require('async');
var http = require('http');
var common = require('./common.js');
var api = require('exo_browser');


// ## core_ui
//
// Breach `core` module UI implementation
//
// The `core_ui` object is in charge of servicing html pages to serve as UI
// for the `core_module`. This pages are served locally using express.
// Eventual routes are handled here.
//
// This includes:
// - A splash page displayed at startup (loading feedback)
// - A module management page
//
// ```
// @spec { core_module, session }
// @inherits {}
// ```
var core_ui = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.core_module = spec.core_module;
  my.session = spec.session;

  my.app = null;
  my.sockets = {};
  my.is_ready = false;

  //
  // #### _public_
  //
  var init;                    /* init(cb_); */
  var kill;                    /* kill(cb_); */

  //
  // #### _private_
  //
  var handshake;               /* handshake(type, socket); */

  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### handshake
  //
  // Called when a core ui client connected to the Socket
  // ```
  // @type   {string} the type of client (splash, ...)
  // @socket {socket.io} the socket.io to connect with
  // ```
  handshake = function(type, socket) {
    common.log.out('[core_ui] HANDSHAKE: ' + type);
    my.sockets[type] = my.sockets[type] || [];
    my.sockets[type].push(socket);
    if(type === 'splash' && my.is_ready) {
      socket.emit('ready');
    }
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/

  /****************************************************************************/
  /* INITIALIZATION */
  /****************************************************************************/
  // ### init
  // 
  // Initialializes the core ui module (spawns an HTTP server) and displays an
  // initial splash page.
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    my.app = express();
    my.app.configure(function() {
      my.app.use('/', express.static(__dirname + '/../static'));
      my.app.use(express.bodyParser());
      my.app.use(express.methodOverride());
      my.app.use(my.app.router);
    });

    my.session.on('ready', function() {
      my.is_ready = true;
      if(my.sockets['splash']) {
        my.sockets['splash'].forEach(function(s) {
          s.emit('ready');
        });
      }
    });

    async.series([
      function(cb_) {
        my.http_srv = http.createServer(my.app).listen(0, '127.0.0.1');
        my.http_srv.on('listening', function() {
          my.port = my.http_srv.address().port;
          my.base_url = 'http://127.0.0.1:' + my.port + '/';
          common.log.out('HTTP Server started on `' + my.base_url + '`');
          return cb_();
        });
      },
      function(cb_) {
        var io = require('socket.io').listen(my.http_srv, {
          'log level': 1
        });
        io.sockets.on('connection', function(socket) {
          socket.on('handshake', function(type) {
            handshake(type, socket);
          });
        });
        return cb_();
      },
      function(cb_) {
        /* Display splash page. */
        my.splash_frame = api.exo_frame({
          name: my.core_module.exo_browser().name() + '_splash',
          url: my.base_url + 'splash',
          session: my.core_module.exo_session()
        });
        async.series([
          function(cb_) {
            my.core_module.exo_browser().add_page(my.splash_frame, cb_);
          },
          function(cb_) {
            my.core_module.exo_browser().show_page(my.splash_frame, cb_);
          }
        ], cb_);
      }
    ], cb_);
  };

  // ### kill
  //
  // Kills the core ui module and shuts down the local server
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  kill = function(cb_) {
    if(global.gc) global.gc();
    return cb_();
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.core_ui = core_ui;
