/*
 * ExoBrowser: commands.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-10-24 spolu   Creation
 */
var common = require('./common.js');
var factory = common.factory;
var api = require('exo_browser');
var async = require('async');
var events = require('events');

// ## commands
//
// Handles commands received from the box
// 
// ```
// @spec { session }
// ```
var commands = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.session = spec.session;
  
  //
  // ### public
  // 
  var execute; /* execute(cmd); */

  //
  // #### that
  //
  var that = new events.EventEmitter();


  // ### execute
  //
  // Executes a text command directly received from the box
  // ```
  // @cmd {string} the command text to execute
  // ```
  execute = function(cmd) {
    console.log('EXECUTE: ' + cmd);
    switch(cmd) {
      case 'e':
      case 'exit': {
        process.exit(0);
        break;
      }
      case 'p':
      case 'prev': {
        var page = my.session.stack().active_page();
        if(page) {
          page.frame.go_back_or_forward(-1);
        }
        break;
      }
      case 'n':
      case 'next': {
        var page = my.session.stack().active_page();
        if(page) {
          page.frame.go_back_or_forward(1);
        }
        break;
      }
      case 'h':
      case 'help': {
        break;
      }
      default:
    }
  };

  common.method(that, 'execute', execute, _super);

  return that;
};

exports.commands = commands;

