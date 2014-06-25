/*
 * Breach: [modules] app.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-06-17 spolu  Modules/Out/Config routing
 * - 2014-06-06 spolu  Enhanced modules output
 * - 2014-06-02 spolu  Fix install/restart action
 * - 2014-05-29 spolu  Support for modules output
 * - 2014-05-23 spolu  Use socket.io
 * - 2014-04-17 spolu  Creation
 */
'use strict';

//
// ## App Module
//
angular.module('breach', ['ngRoute',
                          'breach.services', 
                          'breach.directives', 
                          'breach.filters']).
  config(['$routeProvider', function($routeProvider) {
    $routeProvider.
      when('/',
           { templateUrl: 'partials/modules.html',
             controller: ModulesCtrl }).
      when('/out/:name',
           { templateUrl: '/modules/partials/out.html',
             controller: OutCtrl }).
      /*
      when('/:name/config',
           { templateUrl: '/modules/partials/config.html',
             controller: ConfigCtrl }).
      */
      otherwise({ redirectTo: '/' });
}]);

angular.module('breach.directives', []);
angular.module('breach.filters', []);
angular.module('breach.services', []);


//
// ### TopCtrl
// Initializations goes here as well as global objects
//
function TopCtrl($scope, $location, $rootScope, $window, $timeout, $filter,
                 _bind) {
};

