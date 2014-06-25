/*
 * Breach: [splash] app.js
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
// ## App Module
//
angular.module('breach', ['ngRoute',
                          'breach.services', 
                          'breach.directives', 
                          'breach.filters']).
  config(['$routeProvider', function($routeProvider) {
    $routeProvider.
      when('/',
           { templateUrl: 'partials/splash.html',
             controller: SplashCtrl }).
      when('/onboarding',
           { templateUrl: 'partials/onboarding.html',
             controller: OnBoardingCtrl }).
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

