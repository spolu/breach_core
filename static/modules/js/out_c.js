/*
 * Breach: [module] out_c.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-06-17 spolu  Creation
 */
'use strict';

//
// ## App Module
//
angular.module('breach', ['breach.services', 
                          'breach.directives', 
                          'breach.filters']);

//
// ### OutCtrl
// Controller to manage modules display
//
function OutCtrl($scope, $location, $rootScope, $window, $timeout, $routeParams,
                 _bind, _modules, _req) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking */
  var socket = io.connect();
  socket.emit('tail', $routeParams.name);

  socket.on('module', function(module) {
    $scope.$apply(function() {
      $scope.module = module;
    });
    $rootScope.title = 'out::' + module.name;
  });

  $scope.data = '';
  socket.on('data', function(data) {
    $scope.$apply(function() {
      $scope.data += data;
    });
  });

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/
};

