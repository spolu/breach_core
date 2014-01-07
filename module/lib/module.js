/*
 * Breach: module.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-12-02 spolu   Creation
 */
var events = require('events');

var common = require('./common.js');

// ## module_proxy
//
// ```
// @extends events.EventEmitter
// @spec { module_id, send_message }
// ```
var module_proxy = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.module_id = spec.module_id || 'INVALID';
  my.send_message = spec.send_message;
  
  my.rpc_calls = {};

  // 
  // ### _public_
  //
  var call;  /* call(name, args, cb_); */

  // 
  // ### _protected_
  //
  var rpc_reply; /* rpc_reply(err,res); */

  // 
  // ### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PROTECTED METHODS */                  
  /****************************************************************************/
  // ### rpc_reply
  //
  // Method called when an `rpc_reply` message is received.
  // ```
  // @oid {number} original message id for the `rpc_call`
  // @err {Error} Javascript error if an error occured
  // @res {object} JSON serializable result object
  // ```
  rpc_reply = function(oid, err, res) {
    if(my.rpc_calls[oid]) {
      my.rpc_calls[oid](err, res);
      delete my.rpc_calls[oid];
    }
  };

  /****************************************************************************/
  /* PUBLIC METHODS */                     
  /****************************************************************************/
  // ###
  //
  // Calls a remote procedure. It generates a message and sends it through the
  // `send_message` method. When the reply is received, `rpc_reply` will be
  // triggered, and eventually the callback called
  // ```
  // @hame {string} the procedure name
  // @args {object} serializable JSON arguments
  // @cb_  {function(err, res)} the callback when the rpc completes
  // ```
  call = function(name, args, cb_) {
    var msg = {
      hdr: {
        typ: 'rpc_call'
      },
      dst: my.module_id,
      prc: name,
      arg: args
    };
    var mid = my.send_message(msg);
    my.rpc_calls[mid] = cb_;
    return mid;
  };

  common.method(that, 'rpc_reply', rpc_reply, _super);

  common.method(that, 'call', call, _super);

  return that;
};




// ## module
//
// This object exposes the `breach` module API. It is automatically constructed
// when the module is required and will start communicating with its parent
// process, assuming it is running in a process spawned by Breach.
//
// ```
// @spec {}
// ```
var module = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.proxies = {};
  my.procedures = {};
  my.message_id = 0;

  //
  // #### _public_
  //
  var emit;           /* emit(type, event); */

  var register;       /* register(source, type); */
  var unregister;     /* register(rid); */

  var expose;         /* expose(name, proc(args, cb_(err, res))); */
  var remove;         /* remove(name); */

  var module;         /* module(module_id); */

  //
  // #### _private_
  //
  var send_message;   /* send_message(msg); */
  var handle_message; /* handle_message(msg); */
  var init;           /* init(); */

  //
  // ### _that_
  //
  var that = {};

  /****************************************************************************/
  /* MESAGE HANDLING */                      
  /****************************************************************************/
  // ### handle_message
  //
  // Handles an incoming message from the top process.
  // ```
  // @msg {object} incoming message
  // ```
  handle_message = function(msg) {
    if(!msg || !msg.hdr || 
       typeof msg.hdr.typ !== 'string' ||
       typeof msg.hdr.mid !== 'number' ||
       typeof msg.hdr.src !== 'string') {
      /* We ignore the message. */
      return;
    }
    console.log('HANDLE MSG: ' + JSON.stringify(msg));

    switch(msg.hdr.typ) {
      /* `event` messages are received when the module actually registered    */
      /* for this event class. We trust the core module code for registration */
      /* correctness and just emit that event on the associated module        */
      /* object.                                                              */
      case 'event': {
        if(my.proxies[msg.hdr.src]) {
          my.proxies[msg.hdr.src].emit(msg.typ, msg.evt);
        }
        break;
      }
      /* `rpc_call` messages are received when an other module wants to call  */
      /* a local procedure previously exposed.                                */
      case 'rpc_call': {
        /* This is an helper function to reply to an `rpc_call` message. It */
        /* setps up the headers and store the error or result.              */
        var rcp_reply = function(err, result) {
          msg.oid = msg.hdr.mid;
          msg.hdr.typ = 'rpc_reply';
          if(err) {
            msg.err = {
              nme: err.name,
              msg: err.message
            };
          }
          else {
            msg.res = result;
          }
          send_message(msg);
        };

        if(my.procedures[msg.prc]) {
          my.procedures[msg.prc](msg.arg, rpc_reply);
        }
        else {
          rpc_reply(common.error('Procedure unknown: `' + msg.prc,
                                 'ProcedureUnknown'));
        }
        break;
      }
      /* `rpc_reply` messages are received when an `rpc_call` was previously  */
      /* sent and has received an answer.                                     */
      case 'rpc_reply': {
        if(my.proxies[msg.hdr.src]) {
          var err = null;
          if(msg.err) {
            err = common.error(msg.err.msg, msg.err.name);
          }
          my.proxies[msg.hdr.src].rpc_reply(msg.oid, err, msg.res);
        }
        break;
      }
    }
  };

  // ### send_message
  //
  // Sends a message after setting the `message_id`. The message source will be
  // set by the core module. This methods returns the `message_id` used.
  // ```
  // @msg     {object} the message object
  // @returns {number} the message id
  // ```
  send_message = function(msg) {
    if(!msg || !msg.hdr || 
       typeof msg.hdr.typ !== 'string') {
      /* We ignore the message. */
      return;
    }
    var mid = ++my.message_id;
    msg.hdr.mid = mid;
    process.send(msg);
    return mid;
  };

  /****************************************************************************/
  /* INITIALIZATION */                       
  /****************************************************************************/
  // ### init
  //
  // Inits the module system and handles
  init = function() {
    /* Dummy `init` and `kill` procedures that should be overritten by the */
    /* module implementation.                                              */
    that.expose('init', function(args, cb_) {
      return cb_();
    });
    that.expose('kill', function(args, cb_) {
      return cb_();
    });

    process.on('message', function(msg) {
      handle_message(msg);
    });
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### emit
  //
  // Emits an event for this module
  // ```
  // @type  {string} the event type
  // @event {object} serializable JSON object
  // ```
  emit = function(type, event) {
    var msg = {
      hdr: {
        typ: 'event'
      },
      typ: type,
      evt: event
    };
    return send_message(msg);
  };

  // ### register
  //
  // Registers for remove events from a given module for a given type
  // ```
  // @source  {string} a regexp string to test against module_ids [optional]
  // @type    {string} a regexp string to test against event type [optional]
  // @returns {number} registration id
  // ```
  register = function(source, type) {
    var msg = {
      hdr: {
        typ: 'register'
      },
      src: source || '.*',
      typ: type || '.*'
    };
    return send_message(msg);
  };

  // ### unregister
  //
  // Unregisters a previously created registration by id
  // ```
  // @rid {number} registartion id
  // ```
  unregister = function(rid) {
    var msg = {
      hdr: {
        typ: 'unregister'
      },
      rid: rid
    };
    return send_message(msg);
  };

  // ### expose
  //
  // Exposes a new procedure to the other modules
  // ```
  // @name {string} the procedure call name
  // @proc {function(args, cb_(err, res))} the actual procedure
  // ```
  expose = function(name, proc) {
    console.log('EXPOSED: ' + name);
    my.procedures[name] = proc;
  };

  // ### remove
  //
  // Removes a previously exposed procedure
  // ```
  // @name {string} the procedure name to void
  // ```
  remove = function(name) {
    delete my.procedures[name];
  };

  // ### module
  //
  // Creates ore retrieve the module proxy singleton
  // ```
  // @module_id {string} the module id
  // ```
  module = function(module_id) {
    if(!my.proxies[module_id]) {
      my.proxies[module_id] = module_proxy({
        module_id: module_id,
        send_message: send_message
      });
    }
    return my.proxies[module_id];
  };

  common.method(that, 'emit', emit, _super);

  common.method(that, 'register', register, _super);
  common.method(that, 'unregister', unregister, _super);

  common.method(that, 'expose', expose, _super);
  common.method(that, 'remove', remove, _super);

  common.method(that, 'module', module, _super);

  /* We call init right away */
  init();

  return that;
};

exports.module = module;

