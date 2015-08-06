var db = require('ympc-dbclient');
var config = require('./config');

exports = module.exports = db({
  socket: config.get('redis.socket'),
  host: config.get('redis.host'),
  port: config.get('redis.port'),
  password: config.get('redis.password')
});
