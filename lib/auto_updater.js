/*
 * Breach: auto_updater.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-14 spolu   Creation
 */

var events = require('events');
var async = require('async');
var api = require('exo_browser');
var request = require('request');
var zlib = require('zlib');
var crypto = require('crypto');
var semver = require('semver');
var fs = require('fs-extra');

var common = require('./common.js');

// ## auto_updater
//
// The auto_updater is in charge of auto-updating Breach if possible (writable)
// or notify of a new version availability otherwise.
//
// The auto_updater is executed in the background it will:
// - if BREACH_AUTO_UPDATE env is defined
//   - Download last.breach.cc (JSON)
//   - Compare it with the currently hardcoded version
//   - if a newer version exists
//     - if current executable path is writable
//       - download and extract in /tmp/breach.auto_update
//       - replace files (specificities on OSX / Linux)
//       - emit `update_ready`
//     - if current executable path is not writable
//       - emit `update_available`
//
// The auto_updater expects Bundles on OSX and a certain directory structure 
// around the native executable on Linux. This directory structure must be
// checked an recognized for the update to happen.
//
// This is not a perfect solution on Linux as we have small control on where
// Breach is installed with which permissions. We run the update there only
// if we feel confident it will work.
//
// ```
// @spec { }
// @emits `update_available`, `update_ready`
// ```
var auto_updater = function(spec, my) {
  var _super = {};
  my = my || {};
  spec = spec || {};

  my.VERSION = require('./../package.json').version;
  my.UPDATE_URL = require('./../package.json').auto_update.url;
  my.UPDATE_FREQUENCY = 1000 * 60 * 60 * 2;

  my.update_ready = false;
  my.update_available = false;

  //
  // _public_
  //
  var init;                /* init(cb_); */
  var install_update;      /* install_update(cb_); */

  //
  // _private_
  //
  var check_update;        /* check_last(cb_); */
  var prepare_update;      /* prepare_update(cb_); */
  var clean_update;        /* clean_update(cb_); */

  var can_write;           /* can_write(cb_); */
  var sanity_check;        /* sanity_check(cb_); */
  var tmp_path;            /* tmp_path(update, cb_); */

  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### can_write
  //
  // Returns wheter the path can be written
  // ```
  // @path {string} the path to check
  // @cb_  {function(err, can_write)}
  // ```
  can_write = function(path, cb_) {
    fs.stat(path, function(err, stat) {
      if(err) {
        return cb_(err);
      }
      else {
        can_write = ((process.uid === stat.uid) && (stat.mode * 00200) ||
                     (process.gid === stat.gid) && (stat.mode * 00020) ||
                     (stat.mode & 00002));
        return cb_(null, can_write);
      }
    });
  };

  // ### sanity_check
  // 
  // Checks for the sanity of the current deployment. For auto-update to work
  // we expect the following:
  // `linux`: - [base] = `__dirname/../../../`
  //          - [base] exists and can_write
  //          - [base]/breach [linux wrapper] exists & can_write
  //          - [base]/__AUTO_UPDATE_BUNDLE_/ exists & can_write
  // `darwin`: - [base] = `__dirname/../../`
  //           - [base] is an OSX bundle
  //           - [base]/../ exists and can_write
  // ```
  // @cb_ {function(err)}
  // ```
  sanity_check = function(cb_) {
    if(process.platform === 'linux') {
      var base = require('path').resolve(__dirname, '..', '..', '..');
      var bundle = require('path').join(base, '__AUTO_UPDATE_BUNDLE__');
      var wrapper = require('path').join(base, 'breach');

      //console.log('SANITY_CHECK: ' + bundle);
      async.parallel([
        function(cb_) {
          can_write(base, cb_);
        },
        function(cb_) {
          can_write(bundle, cb_);
        },
        function(cb_) {
          can_write(wrapper, cb_);
        }
      ], cb_);
    }
    else if(process.platform === 'darwin') {
      return cb_();
    }
    else {
      return cb_(common.err('Platform not supported for auto-update: ' + 
                            process.platform,
                            'auto_updater:platform_not_supported'));
    }
  };

  // ### tmp_path
  //
  // Computes the temporary path depending on the platform. If the platform is
  // not supported it returns an error
  // ```
  // @update {object} the objec update
  // @cb_    {function(err, path)}
  // ```
  tmp_path = function(update, cb_) {
    switch(process.platform) {
      case 'linux': {
        return cb_(null, '/tmp/breach.auto_update.v' + update.version);
        break;
      }
      case 'darwin': {
        return cb_(null, '/tmp/breach.auto_update.v' + update.version);
        break;
      }
      default: {
        return cb_(common.err('Platform not supported for auto-update: ' + 
                              process.platform,
                              'auto_updater:platform_not_supported'));
      }
    }
  };

  // ### clean_update
  //
  // Cleans up all transient data for the update
  // ````
  // @update {object} the objec update
  // @cb_ {function(err)}
  // ```
  clean_update = function(update, cb_) {
    tmp_path(update, function(err, path) {
      if(err) {
        return cb_(err);
      }
      else {
        async.parallel([
          function(cb_) {
            fs.remove(path, cb_);
          },
          function(cb_) {
            return cb_();
            fs.remove(path + '.tar.gz', cb_);
          }
        ], cb_);
      }
    });
  };
  
  
  // ### check_update
  //
  // Checks the UPDATE_URL for an update. If an update is found it returns the
  // update object for the platform
  // ````
  // @cb_ {function(err, update)}
  // ```
  check_update = function(cb_) {
    var result = null;
    async.waterfall([
      function(cb_) {
        var options = {
          url: my.UPDATE_URL,
          json: true
        };
        request(options, function(err, res, json) {
          if(err) {
            return cb_(err);
          }
          return cb_(null, json)
        });
      },
      function(update, cb_) {
        if(update && 
           update[process.platform] && 
           update[process.platform][process.arch]) {
          return cb_(null, update[process.platform][process.arch]);
        }
        else {
          return cb_(common.err('No update information for platform: `' + 
                                process.platform + ' ' + process.arch,
                                'auto_updater:no_platform_update'));
        }
      },
      function(update, cb_) {
        if(update.version !== my.VERSION) {
          return cb_(null, update);
        }
        else {
          return cb_(null, null);
        }
      }
    ], cb_);
  };

  // ### prepare_update
  //
  // Check for sanity of the local installation and proceed with downloading
  // and extracting the udpate
  // ```
  // @update {object} the update object recevied from UPDATE_URL
  // @cb_    {function(err)}
  // ```
  prepare_update = function(update, cb_) {
    var path = null;
    async.series([
      function(cb_) {
        sanity_check(cb_);
      },
      function(cb_) {
        clean_update(update, cb_);
      },
      function(cb_) {
        tmp_path(update, function(err, p) {
          if(err) {
            return cb_(err);
          }
          path = p;
          return cb_();
        });
      },
      function(cb_) {
        return cb_(null, path);
        var out = fs.createWriteStream(path + '.tar.gz');
        request({
          url: update.url
        }).on('error', cb_)
          .on('end', cb_)
          .pipe(out)
          .on('error', cb_);
      },
      function(cb_) {
        var hash = crypto.createHash('md5');
        var inp = fs.createReadStream(path + '.tar.gz');
        hash.setEncoding('hex');

        inp.on('error', cb_)
           .on('end', function() {
             hash.end();
             if(hash.read() !== update.md5) {
               return cb_(common.err('Invalid md5 for v' + update.version,
                                     'auto_updater:invalid_md5'));
             }
             else {
               return cb_();
             }
           });
        inp.pipe(hash);
      },
      function(cb_) {
        require('child_process').spawn('tar', ['xfz', path + '.tar.gz'], {
          cwd: '/tmp'
        }).on('close', function (code) {
          if(code !== 0) {
            return cb_(common.err('Extraction failed with code: ' + code,
                                  'auto_updater:failed_extraction'));

          }
          return cb_();
        });
      }
    ], cb_);
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### install_update
  //
  // Installs update if `update_ready` is true (which means we have extracted
  // the update and we are ready to replace the current bundle)
  //
  // If everything goes acccording to plan, this function causes the process
  // to exit after spawning the new version
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  install_update = function(cb_) {
  };

  // ### init
  // 
  // Initialializes the auto_updater and starts checking for updates 
  // periodically
  // ```
  // @cb_ {function(err)} asynchronous callback
  // ```
  init = function(cb_) {
    var check = function() {
      check_update(function(err, update) {
        if(err) {
          common.log.error(err);
        }
        else if(update) {
          async.series([
            function(cb_) {
              prepare_update(update, cb_);
            }
          ], function(err) {
            if(err) {
              common.log.error(err);
              clean_update(update, function(err) {
                if(err) {
                  common.log.error(err);
                }
              });
              my.update_available = true;
              that.emit('update_available', update);
            }
            else {
              my.update_ready = true;
              that.emit('update_ready', update);
            }
          });
        }
        else {
          common.log.out('[auto_updater] ' + 
                         'Breach v' + my.VERSION + ' is up to date');
        }
      });
    };

    if(process.env['BREACH_AUTO_UPDATE']) {
      setInterval(check, my.UPDATE_FREQUENCY); check();
    }
    else {
      common.log.out('[auto_updater] Auto-update not activated');
    }
    if(cb_) return cb_();
  };

  common.method(that, 'init', init, _super);
  common.method(that, 'install_update', install_update, _super);

  common.getter(that, 'update_ready', my, 'update_ready');
  common.getter(that, 'update_available', my, 'update_available');

  return that;
};

exports.auto_updater = auto_updater;
