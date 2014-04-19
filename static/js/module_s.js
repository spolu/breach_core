/*
 * Breach: [module] module_s.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-17 spolu  Creation
 */
'use strict'

//
// ## Module list & commands
//
angular.module('breach.services').
  factory('_module', function(_req, _bind) {
    var _module = {
      list: function() {
        return _req.get('/module/list');
      },
      add: function(path) {
        return _req.post('/module/add', { path: path });
      },
      remove: function(path) {
        return _req.post('/module/remove', { path: path });
      },
      install: function(path) {
        return _req.post('/module/install', { path: path });
      },
      run: function(path) {
        return _req.post('/module/run', { path: path });
      },
      kill: function(path) {
        return _req.post('/module/kill', { path: path });
      },
    };

    return _module;
});

