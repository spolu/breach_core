/*
 * Breach: [dist] darwin.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-16 spolu   Creation
 */
"use strict"

var common = require('../lib/common.js');
var async = require('async');
var mkdirp = require('mkdirp');
var fs = require('fs-extra');
var npm = require('npm');
var path = require('path');

var module_path = path.join(__dirname, '..');
var package_json = require(path.join(module_path, 'package.json'));

var base_name;
var out_path;
var tmp_dist_path;
var out_dist_path;

async.series([
  function(cb_) {
    if(!process.argv[2] && !process.argv[3]) {
      return cb_(common.err('Usage: darwin.js arch path/to/exo_browser.tar.gz',
                            'dist_linux:missing_exo_browser_dist'));
    }
    common.log.out('Making `darwin` distribution for v' + package_json.version);
    common.log.out('Using breach_core: ' + module_path);
    common.log.out('Using arch: ' + process.argv[2]);
    common.log.out('Using ExoBrowser: ' + process.argv[3]);

    base_name = 'breach-v' + package_json.version + '-' + 
      'darwin' + '-' + process.argv[2];
    out_path = path.join(process.cwd(), 'out');
    tmp_dist_path = path.join('/tmp', 'breach.darwin.dist');
    out_dist_path = path.join(out_path, base_name);

    return cb_();
  },
  function(cb_) {
    fs.remove(out_path, cb_);
  },
  function(cb_) {
    fs.remove(tmp_dist_path, cb_);
  },

  /* Extract exo_browser in dist path */
  function(cb_) {
    mkdirp(tmp_dist_path, cb_);
  },
  function(cb_) {
    var tar = require('child_process').spawn('tar', 
      ['xfz', process.argv[3], '-C', tmp_dist_path, '--strip', '1']);
    tar.stdout.on('data', function (data) {
      console.log('stdout: ' + data);
    });
    tar.stderr.on('data', function (data) {
      console.log('stderr: ' + data);
    });
    tar.on('close', function (code) {
      if(code !== 0) {
        return cb_(common.err('Extraction failed with code: ' + code,
                              'auto_updater:failed_extraction'));

      }
      return cb_();
    });
  },
  function(cb_) {
    fs.rename(path.join(tmp_dist_path, 'ExoBrowser.app'), 
              path.join(tmp_dist_path, 'Breach.app'), cb_);
  },

  /* Swap shell/ with content of breach_core/. */
  function(cb_) {
    fs.remove(path.join(tmp_dist_path, 
                        'Breach.app', 'Contents', 'Resources', 'shell'), cb_);
  },
  function(cb_) {
    fs.copy(module_path, 
            path.join(tmp_dist_path, 
                      'Breach.app', 'Contents', 'Resources', 'shell'), cb_);
  },

  /* Final copy. */
  function(cb_) {
    mkdirp(out_path, cb_);
  },
  function(cb_) {
    fs.rename(tmp_dist_path, out_dist_path, cb_);
  },

  /* Final tar */
  function(cb_) {
    var tar = require('child_process').spawn('tar', 
      ['cfz', base_name + '.tar.gz', base_name], {
      cwd: out_path
    });
    tar.stdout.on('data', function (data) {
      console.log('stdout: ' + data);
    });
    tar.stderr.on('data', function (data) {
      console.log('stderr: ' + data);
    });
    tar.on('close', function (code) {
      if(code !== 0) {
        return cb_(common.err('Extraction failed with code: ' + code,
                              'auto_updater:failed_extraction'));

      }
      return cb_();
    });
  }

], function(err) {
  if(err) {
    common.fatal(err);
  }
  process.exit(0);
});

