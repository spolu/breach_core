/*
 * Breach: [splash] onboarding_c.js
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
// ### OnBoardingCtrl
// Controller to manage the splash screen
//
function OnBoardingCtrl($scope, $location, $rootScope, $window, $timeout, $sce, 
                        _bind, _req, _modules) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking [modules] */
  var socket = io.connect();
  socket.emit('handshake', 'modules');

  $scope.step1_status = 'add';
  $scope.step1_error = null;

  $scope.step2_checkbox = true;

  socket.on('modules', function(state) {
    $scope.$apply(function() {
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
      $scope.modules = state;
      if($scope.modules && $scope.modules.length > 0) {
        $scope.modules.forEach(function(m) {
          if(m.name === 'mod_layout') {
            if(m.installing) {
              $scope.step1_add_done = true;
              if(m.install_status === 'dependencies') {
                $scope.step1_download_done = true;
              }
              console.log(m.install_status);
              $scope.step1_status = m.install_status;
            }
          }
        });
      }
    });
  });

  $scope.done_step0 = function() {
    var skip_add = false;
    var skip_running = false;
    var module = null;
    if($scope.modules && $scope.modules.length > 0) {
      $scope.modules.forEach(function(m) {
        if(m.name === 'mod_layout') {
          skip_add = true;
          module = m;
          if(m.running) {
            skip_running = true;
          }
        }
      });
    }

    async.series([
      function(cb_) {
        if(skip_add) {
          return cb_();
        }
        _modules.add('github:breach/mod_layout').then(function(data) {
          module = data.module;
          return cb_();
        }, function(reason) { return cb_(reason); });
      },
      function(cb_) {
        _modules.install(module.path).then(function(data) {
          $scope.step1_dependencies_done = true;
          return cb_();
        }, function(reason) { return cb_(reason); });
      },
      function(cb_) {
        if(skip_running) {
          return cb_();
        }
        _modules.run(module.path).then(function(data) {
          return cb_();
        }, function(reason) { return cb_(reason); });
      }
    ], function(err) {
      if(err) {
        $scope.step1_error = err.split(' at')[0];
      }
      $scope.step1_run_done = true;
    });

    $('.onboarding').addClass('step-1');
    $('.onboarding').removeClass('step-0');
  };

  $scope.done_step1 = function() {
    $('.onboarding').addClass('step-2');
    $('.onboarding').removeClass('step-1');
  };

  $scope.done_step2 = function() {
    $('.onboarding').addClass('step-3');
    $('.onboarding').removeClass('step-2');
  };

  $scope.done_step3 = function() {
    $('.onboarding').addClass('step-4');
    $('.onboarding').removeClass('step-3');
  };

  $scope.done_step4 = function() {
    $location.path('/');
  };
};



