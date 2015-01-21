#!/usr/bin/env node

var path = require('path');
var pkg = require(path.resolve(__dirname, 'package.json'));
var debug = require('debug')('yomypopcorn:scanner');
var config = require('./config.js');
var db = require('./lib/dbclient');
var eztvapi = require('eztvapi');
var through2 = require('through2');
var moment = require('moment');
var CronJob = require('cron').CronJob;
var utils = require('yomypopcorn-utils');

var cb = utils.cb;
var sien = utils.sien;

var eztv = eztvapi({
	apiLimitRequests: config['eztv-rate-limit-requests'],
	apiLimitInterval: config['eztv-rate-limit-interval']
});

if (config.d || config.debug) {
	process.env.DEBUG='*';
}

if (config.v || config.version) {
	console.log(pkg.version);
	process.exit(0);
}

if (config.activescan) {
	return activeScan(function () {
		process.exit(0);
	});
}

if (config.fullscan) {
	return fullScan(function () {
		process.exit(0);
	});
}

var fullScanCron = new CronJob(config['full-scan-cron-pattern'], fullScan, null, true);
var activeScanCron = new CronJob(config['active-scan-cron-pattern'], activeScan, null, true);

function fullScan (done) {
	debug('full scan start');

	var s = stats();

	eztv.createShowsStream()
		.pipe(loadDetails())
		.pipe(postProcess())
		.pipe(checkNewEpisode())
		.pipe(save())
		.pipe(s)
		.pipe(log())
		.pipe(sink())
		.on('error', function (err) {
			debug('full scan error', err);
		})
		.on('finish', function () {
			debug('full scan complete', s.stats);
			db.log('fullscan', s.stats);
			cb(done);
		});
}

function activeScan (done) {
	debug('active scan start');

	var s = stats();

	db.createActiveShowsStream()
		.pipe(loadDetails())
		.pipe(postProcess())
		.pipe(checkNewEpisode())
		.pipe(save())
		.pipe(s)
		.pipe(log())
		.pipe(sink())
		.on('error', function (err) {
			debug('active scan error', err);
		})
		.on('finish', function () {
			debug('active scan complete', s.stats);
			db.log('activescan', s.stats);
			cb(done);
		});
}

function log () {
	var c = 0; 
	return through2.obj(function (chunk, enc, next) {
		c += 1;
		//console.log(c, chunk.title, chunk.active);
		this.push(chunk);
		next();
	});
}

function sink () {
	return through2.obj(function (chunk, enc, next) {
		next();
	});
}

function stats () {
	stream = through2.obj(function (show, enc, next) {
		if (!this.stats) {
			this.stats = {
				start: +moment.utc(),
				end: null,
				duration: 0,
				totalShows: 0,
				activeShows: 0,
				inactiveShows: 0
			};
		}

		this.stats.end = +moment.utc();
		this.stats.duration = this.stats.end - this.stats.start;
		this.stats.totalShows += 1;

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

function loadDetails () {
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

function postProcess () {
	return through2.obj(function (show, enc, next) {
		show.active = false;
		show.active = ([ 'ended', 'canceled' ].indexOf(show.status) === -1);
		show.active = ([ 'returning series', 'continuing', 'in production' ].indexOf(show.status) !== -1);

		var episodes = show.episodes.sort(function (a, b) {
			var x = b.season - a.season;
			return x === 0 ? b.episode - a.episode : x;
		});

		episodes = episodes.filter(function (episode) {
			return (episode.torrents && (Object.keys(episode.torrents).length) > 0);
		});

		show.latestEpisode = episodes[0];

		if (show.latestEpisode) {
			show.latestEpisode.sien = sien(show.latestEpisode.season, show.latestEpisode.episode);
		}

		show.rating = show.rating.percentage;
		show.poster = show.images.poster;
		show.fanart = show.images.fanart;

		this.push(show);
		next();
	});
}

function checkNewEpisode () {
	return through2.obj(function (show, enc, next) {
		var stream = this;

		db.getLatestEpisode(show.imdb_id, function (err, currentEpisode) {
			var latestEpisode = show.latestEpisode;

			if (!latestEpisode) {
				debug('show has no episodes', show.imdb_id);
				stream.push(show);
				return next();
			}

			if (!currentEpisode || latestEpisode.sien > currentEpisode.sien) {

				db.log('episodeupdate', {
					imdb_id: show.imdb_id,
					prev_season: currentEpisode ? currentEpisode.season : null,
					prev_episode: currentEpisode ? currentEpisode.episode : null,
					new_season: latestEpisode ? latestEpisode.season : null,
					new_episode: latestEpisode ? latestEpisode.episode : null
				});

				debug('new episode', show.title, 'S' + latestEpisode.season + 'E' + latestEpisode.episode, latestEpisode.sien);
			}

			stream.push(show);
			next();
		});
	});
}

function save () {
	return through2.obj(function (show, enc, next) {
		var stream = this;

		db.saveShow(show, function () {
			stream.push(show);
			next();
		});
	});
}
