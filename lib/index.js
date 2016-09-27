"use strict";

var ddq, EventEmitter, timers;

ddq = require("./ddq");
EventEmitter = require("events");
timers = require("timers");
module.exports = ddq(EventEmitter, timers);
