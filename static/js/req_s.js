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
  factory('_req', function($http, $q, $rootScope) {

  function go(httpPromise) {
    $rootScope.$broadcast('loading', true);
    var d = $q.defer();
    httpPromise
    .success(function(data, status, headers, config) {
      $rootScope.$broadcast('loading', false);
      d.resolve(data);
    })
    .error(function(data, status, headers, config) {
      $rootScope.$broadcast('loading', false);
      if(!data || !data.error) {
        $rootScope.$broadcast('error', data);
        return d.reject(data);
      }
      else {
        var error = new Error(data.error.message);
        error.name = data.error.name;
        $rootScope.$broadcast('error', data.error);
        return d.reject(data.error.message);
      }
    });
    return d.promise;
  };

  return {
    'get': function(url, config) {
      return go($http.get(url, config));
    },
    'post': function(url, data, config) {
      return go($http.post(url, data, config));
    },
    'put': function(url, data, config) {
      return go($http.put(url, data, config));
    },
    'del': function(url, config) {
      return go($http.delete(url, config));
    }
  };
});
