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
// ### ModulesCtrl
// Controller to manage modules display
//
function ModulesCtrl($scope, $location, $rootScope, $window, $timeout, $sce, 
                     _bind, _modules, _req) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking [modules] */
  var socket = io.connect();
  socket.emit('handshake', 'modules');
  socket.emit('handshake', 'about');

  socket.on('modules', function(state) {
    $scope.$apply(function() {
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
      $scope.modules = state;
    });
  });

  /* Handhsaking [about] */
  socket.on('about', function(state) {
    $scope.$apply(function() {
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
      $scope.about = state;
    });
  });

  $rootScope.title = 'Breach::Modules';

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/
  $scope.modules_install = function() {
    var path = $scope.install_path;
    $scope.install_path = '';
    async.waterfall([
      function(cb_) {
        _modules.add(path).then(function(data) {
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

  $scope.modules_remove = function(path) {
    _modules.remove(path).then(function(data) {
    });
  };

  $scope.modules_update = function(path) {
    _modules.update(path).then(function(data) {
    });
  };

  $scope.modules_kill = function(path) {
    _modules.kill(path).then(function(data) {
    });
  };
  $scope.modules_run = function(path) {
    _modules.run(path).then(function(data) {
    });
  };

  $scope.modules_restart = function(path) {
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

  $scope.about_install = function() {
    _req.post('/about/install', {}).then(function(data) {
    });
  };
};

