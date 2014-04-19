/*
 * Breach: [module] app.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
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
                              _socket, _bind, _module) {

  _bind($scope, 'modules', 
        _module.list().then(function(data) {
    //console.log(data);
    return data;
  }));

  $scope.add = function() {
    _module.add($scope.add_path).then(function(data) {
      location.reload();
    });
  };

  $scope.remove = function(path) {
    _module.remove(path).then(function(data) {
      location.reload();
    });
  };

  $scope.kill = function(path) {
    _module.kill(path).then(function(data) {
      location.reload();
    });
  };
  $scope.run = function(path) {
    _module.run(path).then(function(data) {
      location.reload();
    });
  };
}

angular.module('breach.directives', []);
angular.module('breach.filters', []);
angular.module('breach.services', []);

