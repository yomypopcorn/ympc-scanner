#!/usr/bin/env node

var path = require('path');
var pkg = require(path.resolve(__dirname, '../package.json'));

var config = require('../config.js');
if (config.d || config.debug) { process.env.DEBUG='*'; }

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
