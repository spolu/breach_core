/*
 * Breach: [module] out_c.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-07-03 spolu  Scroll to bottom + cleaer on restart #49
 * - 2014-07-02 spolu  Fix mixed module out #48
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
  _socket.on('chunk', function(chunk) {
    /* The same socket may receive events from multiple modules. */
    if($scope.module.name === chunk.module) {
      $scope.data += chunk.data;
    }
    /* Basically the socket stays open. TODO(spolu): FixMe */
    if($timeout && $('.wrapper') && $('.wrapper')[0]) {
      $timeout(function() {
        $('.wrapper').scrollTop($('.wrapper')[0].scrollHeight);
      });
    }
  });

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/

  $scope.modules_restart = function(path) {
    /* On restart we clear the log buffer. */
    $scope.data = '';
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
};

