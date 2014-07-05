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
                        _bind, _req, _modules, _socket) {

  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/
  /* Handhsaking [modules] */
  _socket.emit('handshake', 'modules');

  _socket.on('modules', function(state) {
      //console.log('========================================');
      //console.log(JSON.stringify(state, null, 2));
      //console.log('----------------------------------------');
    $scope.modules = state;
    if($scope.modules && $scope.modules.length > 0) {
      $scope.modules.forEach(function(m) {
        if(m.name === 'mod_strip') {
          if(m.installing) {
            if(m.install_status === 'dependencies') {
              $scope.step1_download_done = true;
            }
          }
        }
      });
    }
  });

  /****************************************************************************/
  /* STEPS                                                                    */
  /****************************************************************************/
  $scope.done_step0 = function() {

    $scope.step1_error = null;
    var to_install = ['mod_strip', 'mod_stats'];

    /* Detection of current state. */
    var module = {};

    if($scope.modules && $scope.modules.length > 0) {
      $scope.modules.forEach(function(m) {
        if(to_install.indexOf(m.name) !== -1) {
          module[m.name] = m;
        }
      });
    }

    /* Install to_install modules */
    async.series([
      function(cb_) {
        async.each(to_install, function(m, cb_) {
          if(module[m]) {
            return cb_();
          }
          _modules.add('github:breach/' + m).then(function(data) {
            module[m] = data.module;
            return cb_();
          }, function(reason) { return cb_(reason); });
        }, cb_);
      },
      function(cb_) {
        $scope.step1_add_done = true;
        async.each(to_install, function(m, cb_) {
          _modules.install(module[m].path).then(function(data) {
            return cb_();
          }, function(reason) { return cb_(reason); });
        }, cb_);
      },
      function(cb_) {
        $scope.step1_dependencies_done = true;
        async.each(to_install, function(m, cb_) {
          if(module[m].running) {
            return cb_();
          }
          _modules.run(module[m].path).then(function(data) {
            return cb_();
          }, function(reason) { return cb_(reason); });
        }, cb_);
      }
    ], function(err) {
      if(err) {
        $scope.step1_error = err.split(' at')[0];
      }
      else {
        $scope.step1_run_done = true;
      }
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



