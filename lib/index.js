"use strict";

// TA:  What is the point of this file?  Why not include a "main" property in package.json?
var crypto, ddq, EventEmitter;

crypto = require("crypto");
EventEmitter = require("events");
ddq = require("./ddq");
module.exports = ddq(crypto, EventEmitter);
