/*
 * ExoBrowser: filters_d.js
 *
 * Copyright (c) Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-14 spolu    Creation
 */
'use strict';

// ### truncate
// ```
// @text   {string} text to truncate
// @length {number} max length [optional, default: 10]
// @end    {string} end string [optional, default: '...']
// ```
angular.module('breach.filters').
  filter('truncate', function() {
  return function (text, length, end) {
    if (isNaN(length))
      length = 10;
    if (end === undefined)
      end = "...";
    if (text.length <= length) {
      return text;
    }
    else {
      return String(text).substring(0, length-end.length) + end;
    }
  };
});

