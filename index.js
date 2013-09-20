/*
 * ExoBrowser: index.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-11 spolu   Creation
 * 2013-09-06 spolu   Exp1 process.exit on session kill
 */
var express = require('express');
var http = require('http');
var common = require('./lib/common.js');

var factory = common.factory;
var app = express();


var sessions = {};

//
// ### init
//
factory.log().out('Starting...');
(function() {
  /* App Configuration */
  app.configure(function() {
    app.use('/', express.static(__dirname + '/controls'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
  });

  /* TODO(spolu): use the next free port */
  var http_srv = http.createServer(app).listen(8383, '127.0.0.1');
  console.error('HTTP Server started on `http://127.0.0.1:8383`');

  var io = require('socket.io').listen(http_srv, {
    'log level': 1
  });

  io.sockets.on('connection', function (socket) {
    socket.on('handshake', function (name) {
      var name_r = /^(br-[0-9]+)_(.*)$/;
      var name_m = name_r.exec(name);
      if(name_m && sessions[name_m[1]]) {
        sessions[name_m[1]].handshake(name, socket);
      }
    });
  });
})();

//
// ### bootstrap
//
(function() {
  var s = require('./lib/session.js').session({ 
    base_url: 'http://127.0.0.1:8383' 
  })
  sessions[s.name()] = s;
  s.on('kill', function() {
    delete sessions[s.name()];
    if(global.gc) global.gc();
    /* TODO(spolu): For now as we have only one session, let's kill the */
    /* process once we get here.                                        */
    process.exit(0);
  });
})();

