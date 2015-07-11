// based on: https://github.com/hinderberg/yo-api-node
// yoLink added

var request = require('request');

module.exports = Yo;

function Yo(token) {
		if (!token) throw new Error("Token is needed to make an api call");
		this.base = "http://api.justyo.co";
		this.token = token;
};

var proto = Yo.prototype;

proto.yoAll = function (callback) {
	request.post(this.base + "/yoall/", {
		form: {
			api_token:  this.token
		}
	}, callback);
};

proto.yo = function (username, callback) {
	request.post(this.base + "/yo/", {
		form: {
			username:   username,
			api_token:  this.token
		}
	}, callback);
};

proto.yoLink = function (username, link, callback) {
	request.post(this.base + "/yo/", {
		form: {
			link:       link,
			username:   username,
			api_token:  this.token
		}
	}, callback);
};

proto.countOfSubscribers = function (callback) {
	request.get(this.base + "/subscribers_count/", {
		qs: {
			api_token: this.token
		}
	}, callback);
};
