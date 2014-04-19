/*
 * Breach: index.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-17 spolu   Removed monolithic session
 * - 2014-04-15 spolu   Try outs with session_manager
 * - 2014-01-17 spolu   Removed express, exposed module
 * - 2013-11-14 spolu   FMA refactoring
 * - 2013-09-06 spolu   Exp1 process.exit on session kill
 * - 2013-08-11 spolu   Creation
 */
"use strict"

var common = require('./lib/common.js');
var async = require('async');

/******************************************************************************/
/* HELPERS */
/******************************************************************************/


/******************************************************************************/
/* MAIN RUN MODES */
/******************************************************************************/
// ### breach_start
//
// Starts breach and its modules for the local session
var breach_start = function() {
  common.log.out('Starting...');

  var args = process.argv;
  args.forEach(function(a) {
    if(a === '--debug') {
      common.DEBUG = true;
    }
    if(a === '--msg-log') {
      common.MSG_LOG = true;
    }
    if(a === '--msg-dump') {
      common.MSG_DUMP = true;
    }
  });

  // http://localhost:3999/user/1/
  // foobar
  require('./lib/login_manager').login_manager({}).init(function(err) {
    if(err) {
      common.log.error(err);
    }
  });
};



/******************************************************************************/
/* INITIALIZATION */
/******************************************************************************/
breach_start();


// SAFETY NET (kills the process and the spawns)
process.on('uncaughtException', function (err) {
  common.fatal(err);
});
