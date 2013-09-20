/*
 * Nitrogram: session_s.js
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
  factory('_session', function($location, _socket) {

  var session = $location.search().session;

  return {
    'name': function () {
      return session;
    }
  };
});
