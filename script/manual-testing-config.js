"use strict";

module.exports = {
    backend: "mysql",
    backendConfig: {
        database: "testQueue",
        createMessageCycleLimit: 10,
        heartbeatCleanupDelayMs: 15000,
        heartbeatLifetimeSeconds: 5,
        host: "localhost",
        pollingDelayMs: 15000,
        port: 3306,
        table: "queue",
        topics: "Test Topic",
        user: "root"
    },
    heartbeatDelayMs: 10000,
    maxProcessingMessages: 10
};
