#!/usr/bin/env node
"use strict";

var config, Ddq, ddq, i, timers;

Ddq = require("..");
timers = require("timers");
config = {
    backend: "mock",
    backendConfig: {
        pollingDelayMs: 5000
    },
    heartbeatDelayMs: 1000,
    maxProcessingMessages: 10
};
i = 0;
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
ddq.on("error", (err) => {
    console.log("Oh my, there has been an error!");
    console.log(err);
});


/**
 * Logs if there is an error sending the message.
 *
 * @param {Object} err
 */
function messageResponse(err) {
    if (err) {
        console.log(`There was an error sending message: message_${i}`);
        console.log(err);
    }
}


/**
 * Floods the backend with data we wa have lots to use in testing.
 */
function floodWithData() {
    var count, maxNumberOfMessages;

    count = 0;
    maxNumberOfMessages = 15;
    console.log("Flooding instance with data...");
    for (count; count < maxNumberOfMessages; count += 1) {
        i += 1;
        ddq.sendMessage(`message_${i}`, messageResponse);
    }

    // So we can catch some requeues
    if (i >= 25) {
        i = 0;
    }
}

timers.setInterval(() => {
    floodWithData();
}, 25000);

floodWithData();
