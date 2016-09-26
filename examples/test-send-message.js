#!/usr/bin/env node
"use strict";

var config, Ddq, ddq;

Ddq = require("..");
config = {
    backend: "mock",
    backendConfig: {
        pollingRate: 1000
    }
};
ddq = new Ddq(config);
console.log(`Initializing using config: ${JSON.stringify(config)}`);
ddq.sendMessage(process.argv[2], (err) => {
    if (err) {
        console.log("There was an error sending the message.");
        console.log(err);
    } else {
        console.log("Message sent.");
    }
});
