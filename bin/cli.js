#!/usr/bin/env node

var path = require('path');
var pkg = require(path.resolve(__dirname, '../package.json'));
var bole = require('bole');

var config = require('../config.js');

var debugLevel = 'error';
if (config.d === true || config.debug === true) {
  debugLevel = 'debug';
} else if (config.d || config.debug) {
  debugLevel = config.d || config.debug;
}

bole.output({
  level: debugLevel,
  stream: process.stdout
});

var server = require('../server')(config);

if (config.v || config.version) {
	console.log(pkg.version);
	process.exit(0);
}

if (config['active-scan']) {
	return server.activeScan(function () {
		process.exit(0);
	});
}

if (config['full-scan']) {
	return server.fullScan(function () {
		process.exit(0);
	});
}

server.start();
