/*
 * Breach: bind_s.js
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
  factory('_bind', function() {
  return function(host, attr, promise) {
    promise.then(function(data) {
      host[attr] = data;
    });
  };
});

