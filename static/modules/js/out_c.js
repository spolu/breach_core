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
  socket.emit('handshake', 'modules');

  socket.on('state', function(state) {
    $scope.$apply(function() {
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
      state.modules.forEach(function(m) {
        if(m.name === $routeParams.name) {
          $scope.module = m;
        }
      });
    });
  });

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/
};

