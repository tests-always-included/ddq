"use strict";

// TA:  What is the point of this file?  Why not include a "main" property in package.json?
var crypto, ddq, EventEmitter, timers;

crypto = require("crypto");
EventEmitter = require("events");
timers = require("timers");
ddq = require("./ddq");
module.exports = ddq(crypto, EventEmitter, timers);
