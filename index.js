/*
 * Breach: index.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-15 spolu   Try outs with session_manager
 * - 2014-01-17 spolu   Removed express, exposed module
 * - 2013-11-14 spolu   FMA refactoring
 * - 2013-09-06 spolu   Exp1 process.exit on session kill
 * - 2013-08-11 spolu   Creation
 */
"use strict"

var common = require('./lib/common.js');
var async = require('async');
var request = require('request');

/******************************************************************************/
/* HELPSERS */
/******************************************************************************/
// ### create_session
//
// Creates a session and inits it before returning it
// ```
// @cb_ {function(err, session)} asynchronous callback
// ```
var create_session = function(cb_) {
  var s = require('./lib/session.js').session({})
  s.init(cb_);
  s.on('kill', function() {
    console.log('DEV SESSION KILLED: Exiting.');
    process.exit(0);
  });
};


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

  var table_url = 'http://alpha.breach.cc:3999/user/1/';
  var master = 'foobar';
  var timeout = 60 * 60 * 1000;
  var session_token = '';
  var session_manager = null;

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
      session_manager = require('./lib/session_manager.js').session_manager({
        table_url: table_url,
        session_token: session_token
      });
      session_manager.init(cb_);
    },
    function(cb_) {
      session_manager.list_sessions(function(err, sessions) {
        if(err) {
          return cb_(err);
        }
        console.log(sessions);
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      common.log.error(err);
    }
    process.exit(0);
  });


  /*
  create_session(function(err, s) {
    if(err) {
      common.fatal(err);
    }
    s.run_modules();
  });
  */
};

// ### breach_module
//
// Creates the local session and exposes the module manager API
var breach_module = function() {
  var args = process.argv.slice(3);

  var usage = function() {
    common.log.out('Usage:');
    common.log.out('  breach module list');
    common.log.out('  breach module add    [path]');
    common.log.out('  breach module remove [path]');
    common.log.out('  breach module info   [path]');
    process.exit(1);
  }

  if(args.length === 0) {
    return usage();
  }

  create_session(function(err, s) {
    if(err) {
      common.fatal(err);
    }

    switch(args[0]) {
      case 'list': {
        s.module_manager().list(function(err, list) {
          if(err) { 
            common.fatal(err);
          }
          list.forEach(function(m) {
            console.log(m.path + ' ' + m.name + ' ' + m.version + ' ' + m.active);
          });
          process.exit(0);
        });
        break;
      }
      case 'add': {
        if(!args[1]) {
          return usage();
        }
        s.module_manager().add(args[1], function(err) {
          if(err) { 
            common.fatal(err);
          }
          console.log('OK');
          process.exit(0);
        });
        break;
      }
      case 'remove': {
        if(!args[1]) {
          return usage();
        }
        s.module_manager().remove(args[1], function(err) {
          if(err) { 
            common.fatal(err);
          }
          console.log('OK');
          process.exit(0);
        });
        break;
      }
      default: {
        usage();
        break;
      }
    }
  });
};


/******************************************************************************/
/* INITIALIZATION */
/******************************************************************************/
if(process.argv[2] === 'module') {
  breach_module();
}
else {
  breach_start();
}


// SAFETY NET (kills the process and the spawns)
process.on('uncaughtException', function (err) {
  common.fatal(err);
});
