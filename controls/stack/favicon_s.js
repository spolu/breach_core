/*
 * Nitrogram: favicon_s.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-10-31 spolu   Creation
 */
'use strict';

angular.module('breach.services').
  factory('_favicon', function() {

  var cache = {
    'empty': new Image()
  };
  cache['empty'].src = '/favicon.ico';

  return {
    'image': function(url) {
      if(cache[url]) {
        return cache[url];
      }
      else {
        var img = new Image();
        img.src = url;
        img.width = 20;
        img.height = 20;
        $(img).error(function() {
          cache[url] = cache['empty'];
        });
        cache[url] = img;
        return img;
      }
    },
    'empty': function() {
      return cache['empty'];
    }
  };
});
