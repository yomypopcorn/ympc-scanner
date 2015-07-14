var db = require('yomypopcorn-dbclient');
var config = require('./config');

exports = module.exports = db({
  socket: config['redis-docket'],
  host: config['redis-host'],
  port: config['redis-port'],
  password: config['redis-password']
});
