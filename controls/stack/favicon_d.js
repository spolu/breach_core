/*
 * Breach: favicon_d.js
 *
 * Copyright (c) Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-10-31 spolu    Creation
 */
'use strict'

//
// ### FaviconCtrl
// `favicon` directive controller
//
angular.module('breach.directives').controller('FaviconCtrl',
  function($scope, $element, _favicon) {

    $($element).append(_favicon.empty());

    $scope.$watch('url', function(url) {
      if(url && url.length > 0) {
        $($element).empty();
        $(_favicon.image(url)).error(function() {
          $($element).empty();
          $($element).append(_favicon.empty());
        });
        $($element).append(_favicon.image(url));
      }
    });
  });

//
// ## stack
//
// Directive representing the actual stack
//
// ```
// @=entries    {array} the entries array
// ```
//
angular.module('breach.directives').directive('favicon', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      url: '=url',
    },
    templateUrl: 'favicon_d.html',
    controller: 'FaviconCtrl'
  };
});
