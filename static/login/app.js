/*
 * Breach: [login] app.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-18 spolu  Creation
 */
'use strict';

//
// ## App Module
//
angular.module('breach', ['breach.services', 
                          'breach.directives', 
                          'breach.filters']);

//
// ### LoginManagerTopCtrl
// Initializations goes here as well as global objects
//
function LoginManagerTopCtrl($scope, $location, $rootScope, $window, $timeout,
                             _bind, _login) {

  $scope.auth = function() {
    $('#start').css({ visibility: 'hidden' });
    _login.post_session_credentials($scope.table_url, $scope.master).then(function(data) {
      $('#response').text(JSON.stringify(data));
      return data;
    }, function(reason) {
      $('#response').text(JSON.stringify(reason));
    });
  };

}

angular.module('breach.directives', []);
angular.module('breach.filters', []);
angular.module('breach.services', []);

