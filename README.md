DeDuplicated Queue (DDQ)
========================

About
-----

This module was created because of the need of a system which acts like a queue for tasks but doesn't allow for duplication of the tasks. We accomplish this by creating a hash of the data and use that as the primary key in the database or which ever method used to store the data. We don't want to tie ourselves or anyone else to a particular storage style, so we provide an abstraction layer for that.

Usage
-----

    var DeDuplicatedQueue, deduplicatedQueue;

    DeDuplicatedQueue = require("ddq");

    // Pass in the config including which backend to use and DDQ will find it and use it.
    deduplicatedQueue = new DeDuplicatedQueue({
        backend: "mysql",
        backendConfig: {
            host: "localhost",
            password: "someReallyNiceLongSecurePassword",
            port: 3306,
            user: "hopefullyNotRoot"
        }
    });

    // This gives your code access to the functions.

    // Sends the message to the queue backend. This autom
    deduplicatedQueue.sendMessage(anything, callback);

    // Gets the message from the queue backend to use in your consumer.
    deduplicatedQueue.getWrappedMessage();

    // Starts listening for events.
    deduplicatedQueue.listen();

    // Stop listening to events and close the connection to the database.
    deduplicatedQueue.close();

    // DDQ uses event emitters and you'll need to listen for them so your applications can take actions.
    deduplicatedQueue.on("data", callback(err));
    deduplicatedQueue.on("error", callback(err));
