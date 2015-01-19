module.exports = require('rc')('yomypopcorn-scanner', {
	redis: {
		socket: null,
		host: '127.0.0.1',
		port: 6379,
		password: null
	},

	eztv: {
		rateLimitRequests: 1,
		rateLimitInterval: 1000
	},

	scan: {
		fullScanCronPattern: '15 45 * * * *',
		activeScanCronPattern: '0 */5 * * * *'
	}
});
