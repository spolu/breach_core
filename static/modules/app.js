/*
 * Breach: [module] app.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-23 spolu  Use socket.io
 * - 2014-04-17 spolu  Creation
 */
'use strict';

//
// ## App Module
//
angular.module('breach', ['breach.services', 
                          'breach.directives', 
                          'breach.filters']);

//
// ### ModuleManagerTopCtrl
// Initializations goes here as well as global objects
//
function ModuleManagerTopCtrl($scope, $location, $rootScope, $window, $timeout,
                              _socket, _bind, _modules) {

  /* Handhsaking */
  _socket.emit('handshake', 'modules');

  _socket.on('state', function(state) {
    $scope.modules = state.modules;
    console.log('========================================');
    console.log(JSON.stringify(state, null, 2));
    console.log('----------------------------------------');
  });

  $scope.install = function() {
    _modules.add_install($scope.install_path).then(function(data) {
      console.log('OK');
    });
  };

  $scope.remove = function(path) {
    _modules.remove(path).then(function(data) {
      location.reload();
    });
  };

  $scope.kill = function(path) {
    _modules.kill(path).then(function(data) {
      location.reload();
    });
  };
  $scope.run = function(path) {
    _modules.run(path).then(function(data) {
      location.reload();
    });
  };
}

angular.module('breach.directives', []);
angular.module('breach.filters', []);
angular.module('breach.services', []);

