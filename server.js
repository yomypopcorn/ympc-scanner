var url = require('url');
var log = require('bole')('scanner');
var Promise = require('bluebird');
var db = require('./dbclient');
var eztvapi = require('eztvapi');
var through2 = require('through2');
var moment = require('moment');
var CronJob = require('cron').CronJob;
var assign = require('object-assign');
var utils = require('ympc-utils');
var kue = require('kue');
var cuid = require('cuid');

var cb = utils.cb;
var sien = utils.sien;
var generateUserToken = utils.generateUserToken;

var activeShowStatuses = [ 'returning series', 'continuing', 'in production', 'planned' ];
var inactiveShowStatuses = [ 'ended', 'canceled' ];

function isErrorCode (code) {
  return function (err) {
    return err.statusCode === code;
  }
}

exports = module.exports = server;

function server (config) {
  var appUrl = config.get('app.url');

  var createToken = function (username) {
    return generateUserToken(config.yoApiKey, username);
  };

  log.debug('running as ' + process.env.USER);

  var rateLimit = config.get('eztv.ratelimit').split('/');
  var rateLimitRequests = parseInt(rateLimit[0], 10);
  var rateLimitInterval = parseInt(rateLimit[1], 10);

  var eztv = eztvapi({
    apiLimitRequests: rateLimitRequests,
    apiLimitInterval: rateLimitInterval
  });

  var q = config.get('redis.socket')
    ? kue.createQueue({
        prefix: 'queue',
        redis: {
          socket: config.get('redis.socket'),
          auth: config.get('redis.password')
        }
      })

    : kue.createQueue({
      prefix: 'queue',
      redis: {
        port: config.get('redis.port'),
        host: config.get('redis.host'),
        auth: config.get('redis.password')
      }
    });

  function start () {
    log.debug('server started in daemon mode');
    log.debug('full scan pattern', config.get('scan.full.cronpattern'));
    log.debug('active scan pattern', config.get('scan.active.cronpattern'));

    var fullScanCron = new CronJob(config.get('scan.full.cronpattern'), fullScan, null, true);
    var activeScanCron = new CronJob(config.get('scan.active.cronpattern'), activeScan, null, true);
  }

  function fullScan (done) {
    log.info('full scan start');

    var s = stats();

    return eztv.createShowsStream()
      .pipe(loadDetails(eztv))
      .pipe(postProcess())
      .pipe(saveShow())
      .pipe(saveEpisodesIfActive())
      .pipe(checkNewEpisode())
      .pipe(saveLatestEpisodeIfNew())
      .pipe(addEpisodesToSubscriberFeeds())
      .pipe(notifySubscribers())
      .pipe(dbg())
      .pipe(s)
      .pipe(sink())
      .on('error', function (err) {
        log.error('full scan error', err);
      })
      .on('finish', function () {
        log.info('full scan complete', s.stats);
        db.log('fullscan', s.stats);
        cb(done);
      });
  }

  function activeScan (done) {
    log.info('active scan start');

    var s = stats();

    db.createActiveShowsStream()
      .pipe(loadDetails(eztv))
      .pipe(postProcess())
      .pipe(saveShow())
      .pipe(saveEpisodesIfActive())
      .pipe(checkNewEpisode())
      .pipe(saveLatestEpisodeIfNew())
      .pipe(addEpisodesToSubscriberFeeds())
      .pipe(notifySubscribers())
      .pipe(dbg())
      .pipe(s)
      .pipe(sink())
      .on('error', function (err) {
        log.error('active scan error', err);
      })
      .on('finish', function () {
        log.info('active scan complete', s.stats);
        db.log('activescan', s.stats);
        cb(done);
      });
  }

  function sink () {
    return through2.obj(function (chunk, enc, next) {
      next();
    });
  }

  function stats () {
    var stream = through2.obj(function (show, enc, next) {
      if (!this.stats) {
        this.stats = {
          start: +moment.utc(),
          end: null,
          duration: 0,
          totalShows: 0,
          activeShows: 0,
          inactiveShows: 0,
          newEpisodes: 0
        };
      }

      this.stats.end = +moment.utc();
      this.stats.duration = this.stats.end - this.stats.start;
      this.stats.totalShows += 1;

      if (show.hasNewEpisode) {
        this.stats.newEpisodes += 1;
      }

      if (show.active) {
        this.stats.activeShows += 1;
      } else {
        this.stats.inactiveShows += 1;
      }

      this.push(show);
      next();
    });

    return stream;
  }

  function loadDetails (eztv) {
    return through2.obj(function (show, enc, next) {
      var stream = this;

      eztv.getShow(show.imdb_id, function (err, details) {
        if (err) { return next(); }

        details.status = details.status.toLowerCase();
        stream.push(details);
        next();
      });
    });
  }

  function dbg () {
    return through2.obj(function (show, enc, next) {
      log.debug(show.id);
      this.push(show);
      next();
    });
  }

  function postProcess () {
    return through2.obj(function (show, enc, next) {
      var isActive = false;
      isActive = inactiveShowStatuses.indexOf(show.status) === -1;
      isActive = activeShowStatuses.indexOf(show.status) !== -1;

      if (activeShowStatuses.concat(inactiveShowStatuses).indexOf(show.status) === -1) {
        log.warn('show', show._id, 'has unidentified status:', show.status);
      }

      var newShow = {
        id: show._id,
        imdb_id: show.imdb_id,
        tvdb_id: show.tvdb_id,
        active: isActive,
        title: show.title,
        slug: show.slug,
        synopsis: show.synopsis,
        year: show.year,
        network: show.network,
        air_day: show.air_day,
        air_time: show.air_time,
        country: show.country
      };

      if (show.rating && show.rating.hated) { newShow.rating_hated = +show.rating.hated; }
      if (show.rating && show.rating.loved) { newShow.rating_loved = +show.rating.loved; }
      if (show.rating && show.rating.percentage) { newShow.rating = +show.rating.percentage; }

      if (show.images && show.images.poster) { newShow.poster = show.images.poster; }
      if (show.images && show.images.fanart) { newShow.fanart = show.images.fanart; }
      if (show.images && show.images.banner) { newShow.banner = show.images.banner; }

      var episodes = show.episodes
        .map(function (episode) {
          var hasTorrents = episode.torrents && (Object.keys(episode.torrents).length) > 0;

          return {
            title: episode.title,
            sien: sien(episode.season, episode.episode),
            season: episode.season,
            episode: episode.episode,
            overview: episode.overview,
            first_aired: episode.first_aired * 1000,
            tvdb_id: episode.tvdb_id,
            active: hasTorrents
          };
        })
        .reduce(function (episodes, episode) {
          episodes[episode.sien] = episode;
          return episodes;
        }, {});

      var latestEpisode = episodes[Object.keys(episodes).reduce(function (latestKey, currentKey) {
        var latest = episodes[latestKey];
        var current = episodes[currentKey];

        if (!current.active) { return latestKey; }
        if (!latest || current.sien >= latest.sien) { return currentKey; }
        return latestKey;
      }, null)] || null;;

      newShow.latestEpisode = latestEpisode;
      newShow.episodes = episodes;

      this.push(newShow);
      next();
    });
  }

  function saveShow () {
    return through2.obj(function (show, enc, next) {
      var stream = this;

      db.saveShow(show)
        .finally(function () {
          stream.push(show);
          next();
        })
    });
  }

  function saveEpisodesIfActive () {
    return through2.obj(function (show, enc, next) {
      var stream = this;

      var hasEpisodes = !!Object.keys(show.episodes).length;

      if (!show.active || !hasEpisodes) {
        stream.push(show);
        return next();
      }

      var saves = Promise.map(Object.keys(show.episodes), function (key) {
        return db.saveEpisode(show.id, show.episodes[key]);
      });

      Promise.settle(saves)
        .then(function () {
          stream.push(show);
          next();
        });

    });
  }

  function checkNewEpisode () {
    return through2.obj(function (show, enc, next) {
      var stream = this;

      var hasEpisodes = !!Object.keys(show.episodes).length;

      if (!hasEpisodes) {
        log.info('show has no episodes:', show.id);
      }

      if (!show.active || !show.latestEpisode || !hasEpisodes) {
          show.hasNewEpisode = false;
          stream.push(show);
          return next();
      }

      db.getLatestEpisode(show.id)
        .then(function (episode) {
          show.hasNewEpisode = !episode || show.latestEpisode.sien > episode.sien;

          if (show.hasNewEpisode) {
            log.info('new episode for ' + show.id + ':', 'S' + show.latestEpisode.season + 'E' + show.latestEpisode.episode);
          }

          stream.push(show);
          next();
        });
    });
  }

  function saveLatestEpisodeIfNew () {
    return through2.obj(function (show, enc, next) {
      var stream = this;

      if (!show.hasNewEpisode) {
        stream.push(show);
        return next();
      }

      db.saveLatestEpisode(show.id, show.latestEpisode)
        .then(function () {
          stream.push(show);
          next();
        });
    });
  }

  function addEpisodesToSubscriberFeeds () {
    return through2.obj(function (show, enc, next) {
      var stream = this;

      if (!show.hasNewEpisode) {
        stream.push(show);
        return next();
      }

      var addToUserFeed = function (showId) {
        return function (userId) {
          return db.addLatestEpisodeToFeed(userId, showId);
        };
      };

      db.getSubscribers(show.id)
        .map(addToUserFeed(show.id))
        .then(function () {
          stream.push(show);
          next();
        });
    });
  }

  function notifySubscribers () {
    return through2.obj(function (show, enc, next) {
      var stream = this;

      if (show.hasNewEpisode) {

        var sendYoLink = function (userId) {
          return new Promise(function (resolve, reject) {
            var payload = {
              userId: userId,
              showId: show.id,
              token: createToken(userId),
              ref: 'scanner',
              yoid: cuid()
            };

            var parsedLink = url.parse(appUrl, true);
            parsedLink.search = null;
            parsedLink.pathname = '/feed';
            assign(parsedLink.query, {
              username: payload.userId,
              token: payload.token,
              yoid: payload.yoid,
              yoref: payload.ref
            });

            payload.link = url.format(parsedLink)

            var job = q.create('sendyo', payload)
              .priority('normal')
              .attempts(5)
              .backoff({ delay: 20 * 60 * 1000, type: 'exponential' })
              .save(function (err) {
                if (err) { return reject(err); }

                log.info('created sendyo job:', job.id, {
                  userId: payload.userId,
                  showId: payload.showId,
                  yoid: payload.yoid
                });
                resolve();
              });
          });
        };

        var yos = db.getSubscribers(show.id)
          .map(sendYoLink);

        Promise.settle(yos);
      }

      stream.push(show);
      next();
    });
  }

  return {
    activeScan: activeScan,
    fullScan: fullScan,
    start: start
  };
}
