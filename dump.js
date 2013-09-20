/*
 * ExoBrowser: dump.js
 *
 * (c) Copyright Stanislas Polu 2013. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * 2013-09-09 spolu   Creation
 */
var common = require('./lib/common.js');
var factory = common.factory;
var fs = require('fs');
var ncp = require('ncp');

var src = __dirname;
var dst = process.cwd() + '/app';

/* We simply copy the app directory (this file directory) inside the current */
/* working directory.                                                        */
console.log('Copying default \'app/\' inside \'' + dst + '\'...');

ncp.limit = 4;

fs.lstat(dst, function(err, stats) {
  if(stats) {
    console.error(new Error('Directory \'' + dst + '\' already exists!'));
    process.exit(1);
  }
  if(err && err.code !== 'ENOENT') {
    console.error(err);
    process.exit(1);
  }
  else if(err.code == 'ENOENT') {
    ncp(src, dst, function(err) {
      if(err) {
        console.error(err);
        process.exit(1);
      }
      console.log('Done!');
      process.exit(0);
    });
  }
});


