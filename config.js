var defaults = {
  redis: {
    socket: null,
    host: '127.0.0.1',
    port: 6379,
    password: null
  },

  app: {
    url: 'http://app.yomypopcorn.com'
  },

  yo: {
    apikey: 'yo-api-key'
  },

  eztv: {
    ratelimit: '1/1000'
  },

  scan: {
    full: { cronpattern: '0 0 0 * * *' },
    active: { cronpattern: '0 0 1-23 * * *' }
  }
};

var aliases = {
  d: 'debug',
  v: 'version'
};

module.exports = require('rucola')('ympc-scanner', defaults, aliases);
