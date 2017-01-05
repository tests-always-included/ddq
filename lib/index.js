"use strict";

var configValidation, ddq, EventEmitter, timers;

configValidation = require("./config-validation")();
ddq = require("./ddq");
EventEmitter = require("events");
timers = require("timers");
module.exports = ddq(configValidation, EventEmitter, timers);
