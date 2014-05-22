/**
 * Breach: common.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-16 spolu   Added `exit` method
 * - 2014-01-14 spolu   Added `hash` method
 * - 2013-13-15 spolu   Creation
 */
var util = require('util');
var events = require('events');
var crypto = require('crypto');

"use strict";

/******************************************************************************/
/* GLOBAL CONFIG */
/******************************************************************************/

exports.DEBUG = false;
exports.MSG_LOGGING = false;
exports.MSG_DUMP = false;

/******************************************************************************/
/* CROCKFORD */
/******************************************************************************/

// ### method
//
// Adds a method to the current object denoted by that and preserves _super 
// implementation (see Crockford)
// ```
// @that {object} object to extend
// @name {string} the method name
// @method {function} the method
// @_super {object} parent object for functional inheritence
// ```
exports.method = function(that, name, method, _super) {
  if(_super) {
    var m = that[name];
    _super[name] = function() {
      return m.apply(that, arguments);
    };    
  }
  that[name] = method;    
};

// ### getter
//
// Generates a getter on obj for key
// ```
// @that {object} object to extend
// @name {string} the getter name
// @obj {object} the object targeted by the getter
// @key {string} the key to get on obj
// ```
exports.getter = function(that, name, obj, prop) {
  var getter = function() {
    return obj[prop];
  };
  that[name] = getter;
};

// ### setter
//
// Generates a getter on obj for key
// ```
// @that {object} object to extend
// @name {string} the getter name
// @obj {object} the object targeted by the getter
// @key {string} the key to get on obj
// ```
exports.setter = function(that, name, obj, prop) {
  var setter = function (arg) {
    obj[prop] = arg;
    return that;
  };  
  that['set' + name.substring(0, 1).toUpperCase() + name.substring(1)] = setter;
  that['set' + '_' + name] = setter;
};

// ### responds
//
// Tests wether the object responds to the given method name
// ```
// @that {object} object to test
// @name {string} the method/getter/setter name
// ```
exports.responds = function(that, name) {
    return (that[name] && typeof that[name] === 'function');
};


/******************************************************************************/
/* HELPERS */
/******************************************************************************/

// #### once
//
// Returns a function that will call the underlying function only once
// whether it is called once or multiple times 
// ```
// @fn {function} function to call once
// ```
exports.once = function(fn) {
  if(fn === void 0 || fn === null || typeof fn !== 'function')
    throw new TypeError();

  var done = false;
  return function() {    
    if(!done) {
      args = Array.prototype.slice.call(arguments);
      done = true;
      fn.apply(null, args);
    }
  };
};

// ### remove
//
// Removes the element e from the Array, using the JS '===' equality
// ```
// @that {array} the array to operate on
// @e {object} element to remove from the array
// ```
exports.remove = function(that, e) {
  "use strict";
  
  if(that === void 0 || that === null || !Array.isArray(that))
    throw new TypeError();
  
  for(var i = that.length - 1; i >= 0; i--)
    if(e === that[i]) that.splice(i, 1);        
};

// ### clamp
//
// Clamp a given integer to a specified range and pad
// ```
// @v {number} value
// @min {number} minimum
// @max {number} maximum
// ```
exports.clamp = function(v, min, max) {
  if (v < min)
    return min;
  if (v > max)
    return max;
  return v;
};

// ### lpad
//
// Pads a string to the provided length with ' ' or opt_ch
// ```
// @str {string} string to pad
// @length {number} pad to length character
// @opt_ch {string} [optional] character
// ```
exports.lpad = function(str, length, opt_ch) {
  str = String(str);
  opt_ch = opt_ch || ' ';

  while (str.length < length)
    str = opt_ch + str;

  return str;
};

// ### rpad
//
// Pads a string to the provided length with ' ' or opt_ch
// ```
// @str {string} string to pad
// @length {number} pad to length character
// @opt_ch {string} [optional] character
// ```
exports.rpad = function(str, length, opt_ch) {
  str = String(str);
  opt_ch = opt_ch || ' ';

  while (str.length < length)
    str += opt_ch;

  return str.substr(0, length);
};

// ### zpad
//
// Pads a string to the provided length with zeroes
// ```
// @str {string} string to pad
// @length {number} pad to length character
// ```
exports.zpad = function(str, length) {
  return exports.lpad(str, length, '0');
};

// ### hash
//
// Computes a hash value from the given strings
// ```
// @strings {array} an array of string used to update HMAC
// @encoding {string} the encoding used [optional] (default: 'hex')
// @return {string} the hash value
// ```
//
exports.hash = function(strings, encoding) {
  encoding = encoding || 'hex';
  var hash = crypto.createHmac('sha1', '');
  strings.forEach(function(update) {
    hash.update(new Buffer(update.toString()));
  });
  return hash.digest(encoding);
};


/******************************************************************************/
/* LOGGING AND ERROR REPORTING */
/******************************************************************************/

var log = function(str, debug, error) {
  var pre = '[' + new Date().toISOString() + '] ';
  //pre += (my.name ? '{' + my.name.toUpperCase() + '} ' : '');
  pre += (debug ? 'DEBUG: ' : '');
  str.toString().split('\n').forEach(function(line) {
    if(error)
      console.error(pre + line)
    else if(debug)
      console.log(pre + line);
    else 
      console.log(pre + line);
  });
};


// ### log
//
// Loging helpers. Object based on the `log` function including 4 logging
// functions: `out`, `error`, `debug`, `info`
// ```
// @str {string|error} the string or error to log
// ```
exports.log = {
  out: function(str) {
    log(str);
  },
  error: function(err) {
    if(typeof err === 'object') {
      log('*********************************************', false, true);
      log('ERROR: ' + err.message);
      log('*********************************************', false, true);
      log(err.stack);
      log('---------------------------------------------', false, true);
    }
    else {
      log('*********************************************', false, true);
      log('ERROR: ' + JSON.stringify(err));
      log('*********************************************', false, true);
      log('---------------------------------------------', false, true);
    }
  },
  debug: function(str) {
    if(exports.DEBUG)
      log(str, true);
  },
  info: function(str) {
    util.print(str + '\n');
  }
};

// ### exit
//
// Makes sure to kill all subprocesses
// ``
// @code {number} exit code
// ```
exports.exit = function(code) {
  try {
    process.kill('-' + process.pid);
  }
  finally {
    process.exit(code);
  }
};

// ### fatal
//
// Prints out the error and exits the process while killing all sub processes
// ```
// @err {error}
// ```
exports.fatal = function(err) {
  exports.log.error(err);
  exports.exit(1);
};

// ### err
//
// Generates a proper error with name set
// ```
// @msg  {string} the error message
// @name {string} the error name
// ```
exports.err = function(msg, name) {
  var err = new Error(msg);
  err.name = name || 'CommonError';
  return err;
};

