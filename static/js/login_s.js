/*
 * Breach: [login] login_s.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-18 spolu  Creation
 */
'use strict'

//
// ## Login Manager Service
//
angular.module('breach.services').
  factory('_login', function(_req, _bind) {
    var _login = {
      post_session_credentials: function(table_url, master) {
        return _req.post('/session/credentials', {
          table_url: table_url,
          master: master
        });
      },
      post_session_open: function() {
        return _req.post('/session/open', {});
      },
    };

    return _login;
});

