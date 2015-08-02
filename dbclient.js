var db = require('ympc-dbclient');
var config = require('./config');

exports = module.exports = db({
  socket: config['redis-socket'],
  host: config['redis-host'],
  port: config['redis-port'],
  password: config['redis-password']
});
