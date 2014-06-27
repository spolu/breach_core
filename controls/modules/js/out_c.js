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
                 _bind, _modules, _req, _socket) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking */
  _socket.emit('tail', $routeParams.name);

  _socket.on('module', function(module) {
    $scope.module = module;
    $window.document.title = 'out::' + module.name;
  });

  $scope.data = '';
  _socket.on('data', function(data) {
    $scope.data += data;
  });

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/
};

