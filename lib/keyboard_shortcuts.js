/*
 * ExoBrowser: keyboard_shortcuts.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-10-23 spolu   More complete/conventional set of shortcuts
 * 2013-09-06 spolu   Fix #60 Added "recover-page"
 * 2013-08-22 spolu   Creation
 */
var common = require('./common.js');
var factory = common.factory;
var api = require('exo_browser');
var async = require('async');
var events = require('events');

// ## keyboard_shortcuts
//
// Handles keyboard events coming globally, perform some analysis (release
// order, modifier release), and emit shortcut events.
// 
// ```
// @spec { session }
// ```
var keyboard_shortcuts = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.session = spec.session;

  my.last = null;
  my.can_commit = false;

  //
  // #### _private_
  // 
  var is_last;  /* is_last(event); */

  //
  // #### that
  //
  var that = new events.EventEmitter();

  // ### is_last
  //
  // Computes whether it is the same event as last event
  // ```
  // @event {object} the event to compare to `last`
  // ```
  is_last = function(event) {
    if(my.last &&
       my.last.type === event.type &&
       my.last.modifiers === event.modifiers &&
       my.last.keycode === event.keycode) {
      return true;
    }
    return false;
  };


  // ### main event handler
  // 
  // Handles the session exo_browser `frame_keyboard` event
  //
  // Events: 
  // - `type`:
  //  `` RawKeyDown = 7 ``
  //  `` KeyUp      = 9 ``
  //
  // - `modifier`:
  //  `` ShiftKey   = 1 << 0 ``
  //  `` ControlKey = 1 << 1 ``
  //  `` AltKey     = 1 << 2 ``
  //  `` MetaKey    = 1 << 3 ``
  //  `` IsLeft     = 1 << 11 ``
  //  `` IsRight    = 1 << 12 ``
  // ```
  // @frame {exo_frame} source
  // @event {object} keyboard event
  // ```
  my.session.exo_browser().on('frame_keyboard', function(frame, event) {
    console.log(JSON.stringify(event));
    var modifier = (1 << 1); /* ctrl */
    var modifier_key = 17;
    if(process.platform === 'darwin') {
      modifier = (1 << 3); /* command */
      modifier_key = 91;
    }

    if(event.type === 7 && (event.modifiers === modifier) &&
       event.keycode === 84 && !is_last(event)) {
      /* Ctrl - T ; No Repetition */
      that.emit('new_page');
    }
    if(event.type === 7 && (event.modifiers === (1 << 0 | modifier)) &&
       event.keycode === 84 && !is_last(event)) {
      /* Ctrl - Shift - T ; No Repetition */
      that.emit('recover_page');
    }

    if(event.type === 7 && (event.modifiers === modifier) &&
       (event.keycode === 76 || event.keycode === 32) && !is_last(event)) {
      /* Ctrl - L | Space ; No Repetition */
      that.emit('go');
    }

    if(event.type === 7 && (event.modifiers === modifier) &&
       (event.keycode === 74 || event.keycode === 40)) {
      /* Ctrl - J | Down ; Repetition OK */
      that.emit('stack_next');
      my.can_commit = true;
    }
    if(event.type === 7 && (event.modifiers === modifier) &&
       (event.keycode === 75 || event.keycode === 38)) {
      /* Ctrl - K | Up ; Repetition OK */
      that.emit('stack_prev');
      my.can_commit = true;
    }

    if(event.type === 7 && (event.modifiers === (1 << 0 | modifier)) &&
       event.keycode === 74 && !is_last(event)) {
      /* Ctrl - Shift - J ; No Repetition */
      that.emit('back');
    }
    if(event.type === 7 && (event.modifiers === (1 << 0 | modifier)) &&
       event.keycode === 75 && !is_last(event)) {
      /* Ctrl - Shift - K ; No Repetition */
      that.emit('forward');
    }
    if(event.type === 7 && (event.modifiers === modifier) &&
       event.keycode === 37 && !is_last(event)) {
      /* Ctrl - Left ; No Repetition */
      that.emit('back');
    }
    if(event.type === 7 && (event.modifiers === modifier) &&
       event.keycode === 39 && !is_last(event)) {
      /* Ctrl - Right ; No Repetition */
      that.emit('forward');
    }

    if(event.type === 7 && (event.modifiers === modifier) &&
       event.keycode === 72) {
      /* Ctrl - H ; Repetition OK */
      that.emit('stack_toggle');
    }

    if(event.type === 9 && (event.modifiers === (1 << 11)) &&
       event.keycode === modifier_key) {
      /* Ctrl (Release); No Repetition */
      if(my.can_commit) {
        my.can_commit = false;
        that.emit('stack_commit');
      }
    }
    /* CapsLock as a Ctrl case */
    if(event.type === 9 && (event.modifiers === modifier) &&
       event.keycode === 20) {
      /* Ctrl (Release); No Repetition */
      if(my.can_commit) {
        my.can_commit = false;
        that.emit('stack_commit');
      }
    }

    if(event.type === 7 && (event.modifiers === modifier) && 
       event.keycode === 87) {
      /* Ctrl - W ; No Repetition */
      that.emit('stack_close');
    }

    if(event.type === 7 && (event.modifiers === modifier) && 
       event.keycode === 80 && !is_last(event)) {
      /* Ctrl - W ; No Repetition */
      that.emit('stack_pin');
    }
      
    if(event.type === 7 && (event.modifiers === modifier) && 
       event.keycode === 70 && !is_last(event)) {
      /* Ctrl - F ; No Repetition */
      that.emit('find_in_page');
    }
    if(event.type === 7 && (event.modifiers === modifier) && 
       event.keycode === 82 && !is_last(event)) {
      /* Ctrl - R ; No Repetition */
      that.emit('reload');
    }

    if(process.platform === 'darwin') {
      /* Command - C ; */
      if(event.type === 7 && (event.modifiers === modifier) &&
         event.keycode === 67) {
        frame.copy_selection();
      }
      /* Command - V ; */
      if(event.type === 7 && (event.modifiers === modifier) &&
         event.keycode === 86) {
        frame.paste();
      }
      /* Command - X ; */
      if(event.type === 7 && (event.modifiers === modifier) &&
         event.keycode === 88) {
        frame.cut_selection();
      }
      /* Command - A ; */
      if(event.type === 7 && (event.modifiers === modifier) &&
         event.keycode === 65) {
        frame.select_all();
      }

      if(event.type === 7 && (event.modifiers === (1 << 0 | modifier)) &&
         event.keycode === 221) {
        /* Ctrl - } ; Repetition OK */
      that.emit('stack_next');
      my.can_commit = true;
      }
      if(event.type === 7 && (event.modifiers === (1 << 0 | modifier)) &&
         event.keycode === 219) {
        /* Ctrl - { ; Repetition OK */
      that.emit('stack_prev');
      my.can_commit = true;
      }

    }

    my.last = event;
  });

  return that;
};

exports.keyboard_shortcuts = keyboard_shortcuts;

