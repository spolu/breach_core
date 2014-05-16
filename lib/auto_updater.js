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
var path = require('path');
var mkdirp = require('mkdirp');

var common = require('./common.js');

// ## auto_updater
//
// The auto_updater is in charge of auto-updating Breach if possible (writable)
// or notify of a new version availability otherwise.
//
// The auto_updater is executed in the background it will:
// - if BREACH_AUTO_UPDATE env is defined
//   - Download https://data.breach.cc/update (JSON)
//   - Compare it with the current version
//   - if a newer version exists
//     - if `sanity_check` pass
//       - download and extract in temporary location
//       - replace files (specificities on OSX / Linux)
//       - emit `update_ready`
//     - if `sanity_check` or anything else fails
//       - emit `update_available`
//
// The auto_updater expects Bundles on OSX and a certain directory structure 
// around the native executable on Linux. This directory structure must be
// checked an recognized for the update to happen.
//
// This is not a perfect solution on Linux as we have small control on where
// Breach is installed with which permissions. We run the update there only
// if we feel confident it will work. (see `sanity_check`)
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
  my.update = null;

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

  var can_write;           /* can_write(p, cb_); */
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
  // @p   {string} the path to check
  // @cb_ {function(err, can_write)}
  // ```
  can_write = function(p, cb_) {
    fs.stat(p, function(err, stat) {
      if(err) {
        return cb_(err);
      }
      else {
        var result = ((process.uid === stat.uid) && (stat.mode * 00200) ||
                     (process.gid === stat.gid) && (stat.mode * 00020) ||
                     (stat.mode & 00002));
        return cb_(null, result);
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
  // `darwin`: - [base] = `__dirname/../../../../`
  //           - [base] is an OSX bundle
  //           - [base]/../ exists and can_write
  // ```
  // @cb_ {function(err)}
  // ```
  sanity_check = function(cb_) {
    if(process.platform === 'linux') {
      var base = path.resolve(__dirname, '..', '..', '..');
      var bundle = path.join(base, '__AUTO_UPDATE_BUNDLE__');
      var wrapper = path.join(base, 'breach');

      //console.log('SANITY_CHECK: ' + base);
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
      var base = path.resolve(__dirname, '..', '..', '..', '..');
      var toplevel = path.resolve(base, '..');
      var contents = path.join(base, 'Contents');

      //console.log('SANITY_CHECK: ' + base);
      async.parallel([
        function(cb_) {
          can_write(base, cb_);
        },
        function(cb_) {
          can_write(toplevel, cb_);
        },
        function(cb_) {
          can_write(contents, cb_);
        },
        function(cb_) {
          if(base.substr(-4) !== '.app') {
            return cb_(common.err('Not an OSX App Bundle path: ' + base,
                                  'auto_updater:sanity_fail'));
          }
          else {
            return cb_();
          }
        }
      ], cb_);
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
        return cb_(null, '/tmp/breach.auto_update-v' + update.version + 
                         '-' + process.platform + '-' + process.arch);
        break;
      }
      case 'darwin': {
        return cb_(null, '/tmp/breach.auto_update-v' + update.version +
                         '-' + process.platform + '-' + process.arch);
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
    tmp_path(update, function(err, p) {
      if(err) {
        return cb_(err);
      }
      else {
        async.parallel([
          function(cb_) {
            fs.remove(p, cb_);
          },
          function(cb_) {
            /* Testing */ //return cb_();
            fs.remove(p + '.tar.gz', cb_);
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
    var tmp = null;
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
          tmp = p;
          return cb_();
        });
      },
      function(cb_) {
        /* Testing */ //return cb_();
        common.log.out('[auto_updater] Downloading: ' + tmp + '.tar.gz... [' +
                       update.url + ']');
        var out = fs.createWriteStream(tmp + '.tar.gz');
        request({
          url: update.url
        }).on('error', cb_)
          .on('end', cb_)
          .pipe(out)
          .on('error', cb_);
      },
      function(cb_) {
        mkdirp(tmp, cb_);
      },
      function(cb_) {
        common.log.out('[auto_updater] Verifying: ' + tmp + '.tar.gz...');
        var hash = crypto.createHash('md5');
        var inp = fs.createReadStream(tmp + '.tar.gz');
        hash.setEncoding('hex');

        inp.on('error', cb_)
           .on('end', function() {
             hash.end();
             if(hash.read() !== update.md5) {
               return cb_(common.err('Invalid md5 for v' + update.version + 
                                     ' ' + hash.read() + ' != ' + update.md5,
                                     'auto_updater:invalid_md5'));
             }
             else {
               return cb_();
             }
           });
        inp.pipe(hash);
      },
      function(cb_) {
        common.log.out('[auto_updater] Extracting: ' + tmp + '.tar.gz...');
        var tar = require('child_process').spawn('tar', 
          ['xfz', tmp + '.tar.gz',
           '-C', tmp, '--strip', '1']);
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
    if(!my.update) {
      return cb_(common.err('No update to install',
                            'auto_updater:no_update'));
    }
    if(process.platform === 'linux') {
      var dst = path.resolve(__dirname, '..', '..', '..');
      var dst_bundle = path.join(dst, '__AUTO_UPDATE_BUNDLE__');
      var dst_wrapper = path.join(dst, 'breach');
      var src = null;
      var src_bundle = null;
      var src_wrapper = null;
      async.series([
        function(cb_) {
          sanity_check(cb_);
        },
        function(cb_) {
          tmp_path(my.update, function(err, p) {
            if(err) {
              return cb_(err);
            }
            src = p;
            src_bundle = path.join(src, '__AUTO_UPDATE_BUNDLE__');
            src_wrapper = path.join(src, 'breach');
            return cb_();
          });
        },
        function(cb_) {
          fs.rename(dst_bundle, dst_bundle + '.old', cb_);
        },
        function(cb_) {
          fs.rename(dst_wrapper, dst_wrapper + '.old', cb_);
        },
        function(cb_) {
          fs.rename(src_bundle, dst_bundle, cb_);
        },
        function(cb_) {
          fs.rename(src_wrapper, dst_wrapper, cb_);
        },
        function(cb_) {
          clean_update(my.update, cb_);
        },
        function(cb_) {
          fs.remove(dst_bundle + '.old', cb_);
        },
        function(cb_) {
          fs.remove(dst_wrapper + '.old', cb_);
        },
        function(cb_) {
          common.log.out('[auto_updater] Bundle replaced. Restarting!');
          var breach = require('child_process').spawn(dst_wrapper, [], {
            detached: true,
            stdio: 'ignore'
          });
          process.nextTick(function() {
            /* TODO(spolu): Smoother exit. */
            common.exit(0);
          });
        }
      ], cb_);
    }
    else if(process.platform === 'darwin') {
      var dst = path.resolve(__dirname, '..', '..', '..', '..');
      var darwin_restart = path.join(dst, 'Contents', 'Resources', 
                                     'shell', 'dist', 'darwin_restart.sh');
      var src = null;
      async.series([
        function(cb_) {
          sanity_check(cb_);
        },
        function(cb_) {
          tmp_path(my.update, function(err, p) {
            if(err) {
              return cb_(err);
            }
            src = path.join(p, 'Breach.app');
            return cb_();
          });
        },
        function(cb_) {
          fs.rename(dst, dst + '.old', cb_);
        },
        function(cb_) {
          fs.rename(src, dst, cb_);
        },
        function(cb_) {
          fs.remove(dst + '.old', cb_);
        },
        function(cb_) {
          fs.chmod(darwin_restart, '755', cb_);
        },
        function(cb_) {
          console.log(darwin_restart);
          console.log(dst);
          common.log.out('[auto_updater] Bundle replaced. Restarting!');
          var breach = require('child_process').spawn(darwin_restart, [dst], {
            detached: true,
            stdio: 'ignore'
          });
          process.nextTick(function() {
            /* TODO(spolu): Smoother exit. Make sure helpers are killed. */
            common.exit(0);
          });
          return cb_();
        }
      ], cb_);
    }
    else {
      return cb_(common.err('Platform not supported for auto-update: ' + 
                            process.platform,
                            'auto_updater:platform_not_supported'));
    }
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
      if(my.update) return;
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
              my.update = update;
              common.log.out('[auto_updater] Update available: v' + 
                             update.version)
              my.update_available = true;
              that.emit('update_available', update);
            }
            else {
              my.update = update;
              common.log.out('[auto_updater] Update ready: v' + update.version)
              my.update_ready = true;
              that.emit('update_ready', update);
              install_update();
            }
          });
        }
        else {
          common.log.out('[auto_updater] ' + 
                         'Breach v' + my.VERSION + ' is up to date!');
        }
      });
    };

    /* TODO(spolu): for now we force it on Darwin (no good solution for env   */
    /* variables). Sanity won't pass anyway if we're running from the command */
    /* line.                                                                  */
    if(process.platform === 'darwin') {
      process.env['BREACH_AUTO_UPDATE'] = 'true';
    }
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

  common.getter(that, 'update', my, 'update');
  common.getter(that, 'update_ready', my, 'update_ready');
  common.getter(that, 'update_available', my, 'update_available');

  return that;
};

exports.auto_updater = auto_updater;
