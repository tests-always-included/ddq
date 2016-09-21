DeDuplicated Queue (DDQ)
========================

[![Build Status][travis-image]][Travis CI]
[![Dependencies][dependencies-image]][Dependencies]
[![Dev Dependencies][devdependencies-image]][Dev Dependencies]
[![codecov.io][codecov-image]][Code Coverage]

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
        },
        heartbeatDelay: 1000,
        maxProcessingMessages: 10
    });

    // This gives your code access to the functions.

    // Sends the message to the queue backend plugin specified.
    deduplicatedQueue.sendMessage("sample message", callback);

    // Starts listening for events.
    deduplicatedQueue.listen();

    // Stop listening to events and close the connection to the database.
    deduplicatedQueue.close();

    // DDQ uses event emitters and you'll need to listen for them so your applications can take actions.
    deduplicatedQueue.on("data", (data, callback) => {
        // Do event work

    });

    deduplicatedQueue.on("error", callback(err));

[Code Coverage]: https://codecov.io/github/tests-always-included/ddq?branch=master
[codecov-image]: https://codecov.io/github/tests-always-included/ddq/coverage.svg?branch=master
[Dev Dependencies]: https://david-dm.org/tests-always-included/ddq#info=devDependencies
[devdependencies-image]: https://david-dm.org/tests-always-included/ddq/dev-status.png
[Dependencies]: https://david-dm.org/tests-always-included/ddq
[dependencies-image]: https://david-dm.org/tests-always-included/ddq.png
[travis-image]: https://secure.travis-ci.org/tests-always-included/ddq.png
[Travis CI]: http://travis-ci.org/tests-always-included/ddq
