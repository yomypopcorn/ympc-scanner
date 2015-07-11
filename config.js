var defaults = {
	'redis-socket': null,
	'redis-host': '127.0.0.1',
	'redis-port': 6379,
	'redis-password': null,

	yoApiKey: 'yo-api-key',
	'eztv-rate-limit': '1/1000',

	'full-scan-cron-pattern': '0 0 0 * * *',
	'active-scan-cron-pattern': '0 0 1-23 * * *'
};

module.exports = require('rc')('yomypopcorn-scanner', defaults);
