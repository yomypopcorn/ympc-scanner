var db = require('yomypopcorn-dbclient');
var config = require('../config');

exports = module.exports = db(config.redis);
