/*
 * Breach: index.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-11-14 spolu   FMA refactoring
 * 2013-09-06 spolu   Exp1 process.exit on session kill
 * 2013-08-11 spolu   Creation
 */
var express = require('express');
var http = require('http');
var common = require('./lib/common.js');

var app = express();

var sessions = {};

common.log.out('Starting...');

//
// ### bootstrap
//
var bootstrap = function(port) {
  var s = require('./lib/session.js').session({ 
    base_url: 'http://127.0.0.1:' + port
  })
  sessions[s.session_id()] = s;
  s.init(function(err) {
    if(err) {
      common.fatal(err);
    }
    /* The session is ready. */
  });
  s.on('kill', function() {
    delete sessions[s.session_id()];
    if(global.gc) global.gc();
    /* TODO(spolu): For now as we have only one session, let's kill the */
    /* process once we get here.                                        */
    process.exit(0);
  });
};

(function() {
  /* App Configuration */
  app.configure(function() {
    app.use('/', express.static(__dirname + '/static'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
  });

  var http_srv = http.createServer(app).listen(0, '127.0.0.1');

  http_srv.on('listening', function() {
    var port = http_srv.address().port;
    common.log.out('HTTP Server started on `http://127.0.0.1:' + port + '`');
    bootstrap(port);
  });
})();

