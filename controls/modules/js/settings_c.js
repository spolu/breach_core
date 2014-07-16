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
  
  var editor = ace.edit("editor");
  editor.setTheme("ace/theme/monokai");
  editor.getSession().setMode("ace/mode/json");
  editor.setShowPrintMargin(false);
  
  _modules.settings_get($routeParams.name).then(function(data) {
    if (data.ok) {
      editor.setValue(JSON.stringify(data.module.settings, null, 2));
      editor.selection.clearSelection();
    }
  });

  /****************************************************************************/
  /* COMMANDS                                                                  */
  /****************************************************************************/

  $scope.settings_save = function() {
    var settings = JSON.parse(editor.getValue());
    
    _modules.settings_post($routeParams.name, settings).then(function(data) {
      console.log('Settings saved', data);
    });
  };

};

