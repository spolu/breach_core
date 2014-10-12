/*
 * Breach: core_ui.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-07-02 spolu  Fix mixed module out #48
 * - 2014-05-29 spolu  Support for modules output
 * - 2014-05-28 spolu  Socket.io integration, auto_update status
 * - 2014-04-18 spolu  Server shutdown on `kill`
 * - 2014-04-17 spolu  Creation
 */
"use strict"

var express = require('express');
var async = require('async');
var http = require('http');
var fs = require('fs');

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
  var init;                     /* init(cb_); */
  var kill;                     /* kill(cb_); */

  var url_for_ui;               /* url_for_ui(type); */
  var ui_for_url;               /* ui_for_url(url); */

  //
  // #### _private_
  //
  var socket_push;               /* socket_push(); */
  var handshake;                 /* handshake(type, socket); */
  var tail;                      /* tail(module, socket); */

  var post_about_install;        /* post_about_install(req, res, next); */

  var post_modules_cmd;          /* post_modules_cmd(req, res, next); */

  //
  // #### _that_
  //
  var that = {};

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### socket_push
  //
  // Pushes the current state on the adequates sockets
  // ```
  // @type   {string} the type of client (splash, ...)
  // ```
  socket_push = function(type) {
    var state = null;
    async.series([
      function(cb_) {
        if(type === 'splash') {
          state = { 
            ready: my.is_ready 
          };
          return cb_();
        }
        else if(type === 'about') {
          state = {
            update_ready: common.auto_updater.update_ready(),
            update_available: common.auto_updater.update_available(),
            version: require('./../package.json').version,
            update: common.auto_updater.update()
          };
          return cb_();
        }
        else if(type === 'modules') {
          my.session.module_manager().list(function(err, list) {
            if(err) {
              return cb_(err);
            }
            state = list;
            return cb_();
          });
        }
      }
    ], function(err) {
      if(err) {
        common.log.error(err);
      }
      else {
        if(my.sockets[type]) {
          my.sockets[type].forEach(function(s) {
            s.emit(type, state);
          });
        }
      }
    });
  };

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
    my.sockets[type].unshift(socket);
    socket_push(type);

    socket.on('disconnect', function() { 
      common.remove(my.sockets[type], socket, true);
    });
  };

  // ### tail
  //
  // Tails the module out to the socket
  // ```
  // @module {string} the module name
  // @socket {socket.io} the socket.io to connect with
  // ```
  tail = function(module, socket) {
    my.session.module_manager().list(function(err, list) {
      if(err) {
        common.log.error(err);
      }
      list.forEach(function(m) {
        if(m.name === module) {
          socket.emit('module', m);

          var r = fs.createReadStream(m.out, { encoding: 'utf8' });
          r.on('data', function(data) {
            socket.emit('chunk', {
              module: module,
              data: data
            });
          });

          var type = 'tail_' + module;
          my.sockets[type] = my.sockets[type] || [];
          if(my.sockets[type].indexOf(socket) !== -1) {
            return;
          }
          else {
            my.sockets[type].push(socket);
          }

          var t = new (require('tail').Tail)(m.out);
          t.on('error', function(err) {
            socket.emit('error', err);
          });
          t.on('line', function(data) {
            socket.emit('chunk', {
              module: module,
              data: data + '\n'
            });
          });
          socket.on('disconnect', function() { 
            common.remove(my.sockets[type], socket, true);
            t.unwatch();
          });
        }
      });
    });
  };


  // ### post_about_install
  //
  // Express route to install new breach update
  // ```
  // POST /about/install_breach
  // ```
  post_about_install = function(req, res, next) {
    common.auto_updater.install_update(function(err) {
      if(err) {
        return next(err);
      }
      else {
        return res.json({ 
          ok: true,
          module: module
        });
      }
    });
  };

  // ### post_modules_cmd
  //
  // Express route to operate on a module
  // ```
  // POST /module/:cmd
  // ```
  post_modules_cmd = function(req, res, next) {
    var path = req.param('path');
    var cmd = req.param('cmd');
    async.waterfall([
      function(cb_) {
        switch(cmd) {
          case 'add': {
            my.session.module_manager().add(path, false, cb_);
            break;
          }
          case 'install': {
            my.session.module_manager().install(path, cb_);
            break;
          }
          case 'remove': {
            my.session.module_manager().remove(path, cb_);
            break;
          }
          case 'update': {
            my.session.module_manager().update(path, cb_);
            break;
          }
          case 'run': {
            my.session.module_manager().run_module(path, cb_);
            break;
          }
          case 'kill': {
            my.session.module_manager().kill_module(path, cb_);
            break;
          }
          default: {
            next(common.err('Invalid module `cmd`: ' + cmd,
                            'core_ui:invalid_module_cmd'));
            break;
          }
        }
        socket_push('modules');
      }
    ], function(err, module) {
      if(err) {
        return next(err);
      }
      socket_push('modules');
      return res.json({ 
        ok: true,
        module: module
      });
    });
  };

  /****************************************************************************/
  /* SOCKET EVENT HANDLERS */
  /****************************************************************************/


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
        return my.base_url + 'modules/';
      }
      default: {
        return my.base_url + 'splash/';
      }
    }
  };

  // ### ui_for_url
  //
  // Returns whether the url is related to the ui core submodule
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
    my.app.use('/', express.static(__dirname + '/../controls'));
    my.app.use(require('body-parser')());
    my.app.use(require('method-override')())

    my.app.post('/modules/:cmd', post_modules_cmd);
    my.app.post('/about/install', post_about_install);

    my.session.on('ready', function() {
      my.is_ready = true;
      socket_push('splash');
    });

    common.auto_updater.on('update_available', function() {
      socket_push('about');
    });
    common.auto_updater.on('update_ready', function() {
      socket_push('about');
    });

    my.session.module_manager().on('state_change', function(module) {
      socket_push('modules');
    });
    my.session.module_manager().on('update_ready', function() {
      socket_push('modules');
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
          socket.on('tail', function(module) {
            tail(module, socket);
          });
        });
        return cb_();
      },
      function(cb_) {
        /* We open the new tab as soon as the server is ready. */
        my.core_module.core_tabs().tabs_new('core', {
          visible: true,
          focus: true,
          id: '__NEW_TAB_ID__'
        }, cb_);
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
