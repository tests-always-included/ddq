#!/usr/bin/env node
/* eslint no-process-exit:0 */
"use strict";

var config, Ddq, ddq;

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
Ddq = require("../lib/index.js");
console.log(`Initializing using config: ${JSON.stringify(config)}`);
ddq = new Ddq(config);
ddq.listen();
console.log("Listening...");
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
