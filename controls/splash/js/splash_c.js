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
                    _bind, _req, _socket) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking [modules] */
  _socket.emit('handshake', 'splash');
  _socket.emit('handshake', 'modules');

  /* Handhsaking [splash] */
  _socket.on('splash', function(state) {
    //console.log('========================================');
    //console.log(JSON.stringify(state, null, 2));
    //console.log('----------------------------------------');
    $scope.splash = state;
  });

  _socket.on('modules', function(state) {
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

};

