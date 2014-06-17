/*
 * Breach: [module] modules_c.js
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
// ### ModulesCtrl
// Controller to manage modules display
//
function ModulesCtrl($scope, $location, $rootScope, $window, $timeout, $sce, 
                     _bind, _modules, _req) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking */
  var socket = io.connect();
  socket.emit('handshake', 'modules');

  socket.on('state', function(state) {
    $scope.$apply(function() {
      $scope.modules = state.modules;
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
      $scope.modules_no_update = true;
      $scope.modules.forEach(function(m) {
        if(m.need_restart) {
          $scope.modules_no_update = false;
        }
      })
      $scope.about = state.about;
    });
  });

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/
  $scope.install = function() {
    async.waterfall([
      function(cb_) {
        _modules.add($scope.install_path).then(function(data) {
          return cb_(null, data.module);
        });
      },
      function(module, cb_) {
        _modules.install(module.path).then(function(data) {
          return cb_(null, data.module);
        });
      },
      function(module, cb_) {
        _modules.run(module.path).then(function(data) {
          return cb_(null, data.module);
        });
      }
    ], function(err) {
    });
  };

  $scope.remove = function(path) {
    _modules.remove(path).then(function(data) {
    });
  };

  $scope.update = function(path) {
    _modules.update(path).then(function(data) {
    });
  };

  $scope.kill = function(path) {
    _modules.kill(path).then(function(data) {
    });
  };
  $scope.run = function(path) {
    _modules.run(path).then(function(data) {
    });
  };

  $scope.restart = function(path) {
    async.series([
      function(cb_) {
        _modules.kill(path).then(function(data) {
          return cb_();
        });
      },
      function(cb_) {
        _modules.run(path).then(function(data) {
          return cb_();
        });
      },
    ], function(err) {
    });
  };

  $scope.install_breach = function() {
    _req.post('/about/install_breach', {}).then(function(data) {
    });
  };
};

