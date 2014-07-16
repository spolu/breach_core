/*
 * Breach: [module] out_c.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-07-15 @julien-c  Creation
 */
'use strict';

//
// ## App Module
//
angular.module('breach', ['breach.services', 
                          'breach.directives', 
                          'breach.filters']);

//
// ### SettingsCtrl
// Controller to manage module settings
//
function SettingsCtrl($scope, $location, $rootScope, $window, $timeout, $routeParams,
                      _bind, _modules, _req, _socket) {
  
  /****************************************************************************/
  /* INITIALIZATION                                                           */
  /****************************************************************************/

  $window.document.title = 'Settings::' + $routeParams.name;

  _modules.settings_get($routeParams.name).then(function(data) {
    if (data.ok) {
      $scope.module = data.module;
    }
  });

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/

  $scope.settings_save = function() {
    var settings = JSON.parse($window.document.getElementById('editor').innerHTML);
    
    _modules.settings_post($routeParams.name, settings).then(function(data) {
      console.log('Settings saved', data);
    });
  };

};

