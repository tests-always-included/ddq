"use strict";

module.exports = {
    createMessageCycleLimit: 10,
    pollingDelayMs: 15000,
    heartbeatCleanupDelayMs: 15000,
    heartbeatLifetimeSeconds: 5,
    host: "localhost",
    database: "testQueue",
    port: 3306,
    table: "queue",
    topic: "Test Topic",
    user: "root"
};
