/*
 * Breach: index.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-14 spolu   [GiG.fs 0.2.x] local only
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

/* This is a hack. But process.nextTick can sleep if there is no event on the */
/* content API part so we replace it here by a setTimeout that will be called */
/* TODO(spolu): find a better solution */
process.nextTick = setTimeout

/******************************************************************************/
/* MAIN RUN MODES */
/******************************************************************************/
// ### breach_start
//
// Starts breach and its modules for the local session
var breach_start = function() {
  common.log.out('[index] Breach v' + require('./package.json').version + 
                 ' Starting...');

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

  /* TODO(spolu): Useful for debugging on OSX. Maybe integrate it in */
  /* module_manager.                                                 */
  /*
  var fs = require('fs');
  var util = require('util');
  var stdout = fs.createWriteStream('/Users/spolu/breach.stdout', { flags: 'a' })
  var fun = console.log;
  console.log = function(d) {
    stdout.write(util.format(d) + '\n');
    fun(d);
  };
  */

  common.auto_updater = require('./lib/auto_updater.js').auto_updater({});
  common.auto_updater.init();

  common.session_manager = require('./lib/session_manager.js').session_manager({
    off_the_record: false
  });
  async.waterfall([
    common.session_manager.init,
    common.session_manager.list_sessions,
    function(sessions, cb_) {
      if(Object.keys(sessions).length === 0) {
        common.session_manager.new_session(false, 'Alpha Session', cb_);
      }
      else {
        return cb_(null, Object.keys(sessions)[0]);
      }
    },
    common.session_manager.open_session
  ], function(err) {
    if(err) {
      common.fatal(err);
    }
    common.log.out('[index] Startup Complete');
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

var sig_handler = function() {
  common.exit(0);
};
process.on('SIGHUP', sig_handler);
process.on('SIGINT', sig_handler);
process.on('SIGQUIT', sig_handler);
process.on('SIGABRT', sig_handler);
process.on('SIGTERM', sig_handler);
