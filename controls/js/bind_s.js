/*
 * Nitrogram: bind_s.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-12 spolu   Creation
 */

'use strict';

angular.module('breach.services').
  factory('_bind', function() {
  return function(host, attr, promise) {
    promise.then(function(data) {
      host[attr] = data;
    });
  };
});

