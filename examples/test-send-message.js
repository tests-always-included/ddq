#!/usr/bin/env node
/* eslint no-process-exit:0 */
"use strict";

var config, Ddq, ddq;

config = {
    backend: "mock",
    pollingRate: 1000
};
Ddq = require("../lib/index.js");
ddq = new Ddq(config);

console.log(`Initializing using config: ${JSON.stringify(config)}`);

ddq.sendMessage(process.argv[2], (err) => {
    console.log("Message Sent");

    if (err) {
        console.log(err);
        console.log("There was an error sending.");
    }
});
