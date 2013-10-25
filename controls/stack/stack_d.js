/*
 * Breach: stack_d.js
 *
 * Copyright (c) Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-15 spolu    Creation
 */
'use strict'

//
// ### StackCtrl
// `stack` directive controller
//
angular.module('breach.directives').controller('StackCtrl',
  function($scope, _socket) {

    $scope.$watch('pages', function(pages) {
      pages = pages || [];
      //console.log(JSON.stringify($scope.pages));
      
      pages.forEach(function(p, i) {
        if(p.state.entries.length > 0) {
          p.state.entries.forEach(function(n) {
            if(n.visible) {
              p.url = n.url;
              p.title = n.title;
              p.favicon = n.favicon;
            }
          });
        }
        p.url = p.url || { hostname: '', href: '' };
        p.title = p.title || '';
        p.favicon = p.favicon || ''
      });
    });

    $scope.select_page = function(page) {
      if(!page.active)
        _socket.emit('select_page', page.name);
    };

    $scope.toggle_pin = function(page) {
      _socket.emit('toggle_pin', page.name);
    };
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
angular.module('breach.directives').directive('stack', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      pages: '=pages',
    },
    templateUrl: 'stack_d.html',
    controller: 'StackCtrl'
  };
});
