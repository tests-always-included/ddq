#!/usr/bin/env node
/* eslint no-process-exit:0 */
"use strict";

var config, Ddq, ddq, i, timers;

config = {
    backend: "mock",
    backendConfig: {
        host: "127.0.0.1",
        port: "3306",
        pollingDelay: 5000
    },
    hostname: "localhost",
    heartbeatDelay: 1000,
    maxProcessingMessages: 10
};
i = 0;
timers = require("timers");
Ddq = require("../lib/index.js");
console.log(`Initializing using config: ${JSON.stringify(config)}`);
ddq = new Ddq(config);
console.log("Listening...");
ddq.listen();
ddq.on("data", (data, callback) => {
    var fail;

    console.log("Found Data!");
    fail = false;

    if (process.argv[2]) {
        console.log("Failing completing task.");
        fail = true;
    }

    setTimeout(() => {
        callback(fail);
    }, 10000);
});
ddq.on("error", () => {
    console.log("Oh my there has been an error!");
});

 timers.setInterval(() => {
    var count, maxNumberOfMessages;

    count = 0;
    maxNumberOfMessages = 5;
    console.log("Flooding instance with data...");
    for(count; count < maxNumberOfMessages; count += 1) {
        i += 1;
        ddq.sendMessage(`message_${i}`, () => {
        });
    }

    // So we can catch some requeues
    if (i >= 25) {
        i = 0;
    }
}, 25000);