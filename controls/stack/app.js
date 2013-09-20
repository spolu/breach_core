/*
 * ExoBrowser: app.js [stack]
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-12 spolu  Creation
 */

'use strict';

//
// ## App Module
//
angular.module('breach', ['breach.services', 
                          'breach.directives', 
                          'breach.filters']);

//
// ### StackTopCtrl
// Initializations goes here as well as global objects
//
function StackTopCtrl($scope, $location, $rootScope, $window, $timeout,
                      _session, _socket) {

  /* Handhsaking */
  _socket.emit('handshake', _session.name() + '_stack');

  _socket.on('pages', function(pages) {
    $scope.pages = pages;
  });
}

angular.module('breach.directives', []);
angular.module('breach.filters', []);
angular.module('breach.services', []);

