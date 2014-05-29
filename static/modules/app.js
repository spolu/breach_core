/*
 * Breach: [module] app.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-29 spolu  Support for modules output
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
                              $sce, _socket, _bind, _modules) {

  /* Handhsaking */
  _socket.emit('handshake', 'modules');

  _socket.on('state', function(state) {
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
    $scope.auto_update = state.auto_update;
  });

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

  $scope.output = function(path) {
    _modules.output(path).then(function(data) {
      $scope.raw_output = $sce.trustAsHtml(data.output.replace(/\n/g, '<br>'));
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
}

angular.module('breach.directives', []);
angular.module('breach.filters', []);
angular.module('breach.services', []);

