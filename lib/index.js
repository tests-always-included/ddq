"use strict";

// TA:  What is the point of this file?  Why not include a "main" property in package.json?
var crypto, Ddq, EventEmitter;

crypto = require("crypto");
EventEmitter = require("events");
Ddq = require("./ddq");
module.exports = Ddq(crypto, EventEmitter);
