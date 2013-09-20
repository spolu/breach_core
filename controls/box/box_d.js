/*
 * ExoBrowser: box_d.js
 *
 * Copyright (c) Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-08-16 spolu    Creation
 */
'use strict'

//
// ### StackCtrl
// `box` directive controller
//
angular.module('breach.directives').controller('BoxCtrl',
  function($scope, $element, $window, $timeout, _socket) {

    var MODE_NORMAL = 1 << 0;
    var MODE_FIND_IN_PAGE = 1 << 1;

    var _input = jQuery($element).find('input');

    $scope.$watch('state', function(state) {
      if(state) {
        $scope.can_go_back = state.can_go_back;
        $scope.can_go_forward = state.can_go_forward;
        $scope.stack_visible = state.stack_visible;
        $scope.mode = state.mode;
        $scope.value = state.value;
        $scope.last = $scope.value; 
        switch($scope.mode) {
          case MODE_FIND_IN_PAGE: {
            $scope.label = 'in page';
            break;
          }
          case MODE_NORMAL: 
          default: {
            $scope.label = null;
            break;
          }
        }
      }
    });


    _socket.on('select_all', function() {
      _input.focus().select();
    });

    $scope.$watch('value', function(value) {
      switch($scope.mode) {
        case MODE_FIND_IN_PAGE: 
        case MODE_NORMAL: 
        default: {
          if($scope.value !== $scope.last) {
            _socket.emit('box_input', $scope.value);
            $scope.last = $scope.value;
          }
          break;
        }
      }
    });

    _input.keydown(function(evt) {
      switch($scope.mode) {
        case MODE_FIND_IN_PAGE: {
          if(evt.keyCode === 27) {
            _socket.emit('box_input_out');
          }
          break;
        }
        case MODE_NORMAL: {
          if(evt.keyCode === 27) {
            _socket.emit('box_input_out');
          }
          break;
        }
      }
    });
    _input.focusout(function() {
      switch($scope.mode) {
        case MODE_FIND_IN_PAGE: {
          _socket.emit('box_input_out');
          break;
        }
      }
    });
    
    _input.keydown(function(e) {
      if($scope.mode === MODE_FIND_IN_PAGE && _input.is(':focus')) {
        if(e.which === 13 && (e.ctrlKey || e.metaKey)) {
          _socket.emit('box_input_submit', { 
            value: $scope.value, 
            is_ctrl: true
          });
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    $scope.submit = function() {
      console.log('submit');
      _socket.emit('box_input_submit', { 
        value: $scope.value, 
        is_ctrl: false
      });
    };

    $scope.back = function() {
      _socket.emit('box_back');
    };
    $scope.forward = function() {
      _socket.emit('box_forward');
    };
  });

//
// ## box
//
// Directive representing the top box
//
// ```
// @=active_url    {string} the current active url
// ```
//
angular.module('breach.directives').directive('box', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      state: '=state',
    },
    templateUrl: 'box_d.html',
    controller: 'BoxCtrl'
  };
});
