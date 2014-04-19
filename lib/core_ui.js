/*
 * Breach: core_ui.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-18 spolu   Server shutdown on `kill`
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
  my.base_url = null;

  //
  // #### _public_
  //
  var init;                    /* init(cb_); */
  var kill;                    /* kill(cb_); */

  var url_for_ui;              /* url_for_ui(type); */
  var ui_for_url;              /* ui_for_url(url); */

  //
  // #### _private_
  //
  var handshake;               /* handshake(type, socket); */
  var get_module_list;         /* get_module_list(req, res, next); */
  var post_module_cmd;         /* post_module_cmd(req, res, next); */

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

  // ### get_module_list
  //
  // Express route to retrieve the list of modules
  // ```
  // GET /module/list
  // ```
  get_module_list = function(req, res, next) {
    my.session.module_manager().list(function(err, list) {
      if(err) {
        next(err);
      }
      else {
        return res.json(list);
      }
    });
  };

  // ### post_module_cmd
  //
  // Express route to operate on a module
  // ```
  // POST /module/:cmd
  // ```
  post_module_cmd = function(req, res, next) {
    var path = req.param('path');
    var cmd = req.param('cmd');
    switch(cmd) {
      case 'add': {
        my.session.module_manager().add(path, function(err) {
          if(err) {
            return next(err);
          }
          return res.json({ ok: true });
        });
        break;
      }
      case 'remove': {
        my.session.module_manager().remove(path, function(err) {
          if(err) {
            return next(err);
          }
          return res.json({ ok: true });
        });
        break;
      }
      case 'install': {
        my.session.module_manager().install(path, function(err) {
          if(err) {
            return next(err);
          }
          return res.json({ ok: true });
        });
        break;
      }
      case 'run': {
        my.session.module_manager().run_module(path, function(err) {
          if(err) {
            return next(err);
          }
          return res.json({ ok: true });
        });
        break;
      }
      case 'kill': {
        my.session.module_manager().kill_module(path, function(err) {
          if(err) {
            return next(err);
          }
          return res.json({ ok: true });
        });
        break;
      }
      default: {
        next(common.err('Invalid module `cmd`: ' + cmd,
                        'core_ui:invalid_module_cmd'));
        break;
      }
    }
  };


  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### url_for_route
  //
  // Returns a redirect url for the given ui type
  // ```
  // @type {string} ui type (`splash`, `modules`, ...)
  // ```
  url_for_ui = function(type) {
    switch(type) {
      case 'modules': {
        return my.base_url + 'modules';
      }
      default: {
        return my.base_url + 'splash';
      }
    }
  };

  // ### ui_for_url
  //
  // Returns wether the url is related to the ui core submodule
  // ```
  // @url {string} the url to test
  // ```
  ui_for_url = function(url) {
    url = require('url').parse(url);
    if((url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1') &&
       url.port === my.port.toString()) {
      switch(url.pathname) {
        case '/modules/': {
          return 'modules'; 
        }
        case '/splash/': {
          return 'splash';
        }
        default: {
          return 'unknown';
        }
      }
    }
    return null;
  };

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
    my.app.use('/', express.static(__dirname + '/../static'));
    my.app.use(require('body-parser')());
    my.app.use(require('method-override')())

    my.app.get( '/module/list', get_module_list);
    my.app.post('/module/:cmd', post_module_cmd);

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
          common.log.out('[core_ui] HTTP Server started on `' + my.base_url + '`');
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
    common.log.out('[core_ui] KILL');
    my.http_srv.close(cb_);
    return cb_();
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'url_for_ui', url_for_ui, _super);
  common.method(that, 'ui_for_url', ui_for_url, _super);

  return that;
};

exports.core_ui = core_ui;
