/*
 * Breach: socket_s.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2013-08-12 spolu   Creation
 */
'use strict';

angular.module('breach.services').
  factory('_socket', function($rootScope) {
  var socket = io.connect();
  return {
    on: function (event, callback) {
      socket.on(event, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (event, data, callback) {
      socket.emit(event, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    }
  };
});
