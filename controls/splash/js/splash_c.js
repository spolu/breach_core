/*
 * Breach: [splash] splash_c.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-06-19 spolu  Creation
 */
'use strict';

//
// ### SplashCtrl
// Controller to manage the splash screen
//
function SplashCtrl($scope, $location, $rootScope, $window, $timeout, $sce, 
                    _bind, _req) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking [modules] */
  var socket = io.connect();
  socket.emit('handshake', 'splash');
  socket.emit('handshake', 'modules');

  /* Handhsaking [splash] */
  socket.on('splash', function(state) {
    $scope.$apply(function() {
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
      $scope.splash = state;
    });
  });

  socket.on('modules', function(state) {
    $scope.$apply(function() {
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
      $scope.modules = state;
      if($scope.modules.length === 0) {
        $location.path("/onboarding");
      }
      else {
        $('.splash').css({ opacity: 1 });
      }
    });
  });

};

