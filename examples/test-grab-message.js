#!/usr/bin/env node
/* eslint no-process-exit:0 */
"use strict";

var config, Ddq, ddq;

config = {
    backend: "mysql",
    pollingRate: 3000,
    heartbeatRate: 1000,
    hostname: "127.0.0.1"
};
Ddq = require("../lib/index.js");
ddq = new Ddq(config);

console.log(`Initializing using config: ${JSON.stringify(config)}`);
ddq.startHeartbeat();
console.log("Starting Heartbeat...");
setTimeout(() => {
    console.log("Finishing message");
    if (process.argv[2]) {
         ddq.messageFailure("1157fde1c0a437301c669e18abb414ac99f9feed462cbb9454cc9b04af1765ac");
    } else {
        ddq.messageSuccess("1157fde1c0a437301c669e18abb414ac99f9feed462cbb9454cc9b04af1765ac");
    }
    process.exit();
}, 3000);
