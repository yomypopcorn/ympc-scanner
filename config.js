module.exports = require('rc')('yomypopcorn-scanner', {
	'redis-socket': null,
	'redis-host': '127.0.0.1',
	'redis-port': 6379,
	'redis-password': null,

	'eztv-limit-requests': 1,
	'eztv-limit-interval': 1000,

	'full-scan-cron-pattern': '0 0 0 * * *',
	'active-scan-cron-pattern': '0 0 * * * *'
});
