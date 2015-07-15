
var crypto = require('crypto');

module.exports = {
  generate: generate,
  validate: validate
};

function generate(username, secret) {
  return crypto
    .createHash('sha1')
    .update(username + secret)
    .digest('hex')
    .substr(0, 16);
}


function validate(username, secret, token) {
  console.log(arguments);
  return generate(username, secret) === token;
}
