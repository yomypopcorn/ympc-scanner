#!/usr/bin/env node

var path = require('path');
var pkg = require(path.resolve(__dirname, '../package.json'));
var bole = require('bole');

var config = require('../config.js');

var logLevel = config.debug === true
  ? 'debug'
  : config.debug || 'error';

bole.output({
  level: logLevel,
  stream: process.stdout
});

var server = require('../server')(config);

if (config.version) {
	console.log(pkg.version);
	process.exit(0);
}

if (config._[0] === 'active-scan') {
	return server.activeScan(function () {
		process.exit(0);
	});
}

if (config._[0] === 'full-scan') {
	return server.fullScan(function () {
		process.exit(0);
	});
}

server.start();
