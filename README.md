DeDuplicated Queue (DDQ)
========================

[![Build Status][travis-image]][Travis CI]
[![Dependencies][dependencies-image]][Dependencies]
[![Dev Dependencies][devdependencies-image]][Dev Dependencies]
[![codecov.io][codecov-image]][Code Coverage]

About
-----

This module was created because of a need for a system which acts like a queue for tasks but doesn't allow for duplication. DDQ uses an `async` methodology to complete certain tasks, sending and receiving messages, then indicating the message has been fully processed. We used `callbacks` instead of `Promises` to make the process faster and easier to integrate with other libraries.

DDQ also extends the Event Emitter module so it's very easy to use events for when there is a message or an error has occured and inform the software of these events.


***** rewrite *****
When a message is emitted for processing the backend should mark it for processing and effectively lock the message from being processed while it is being processed.

DDQ is split into this core library and a backend. The core exposes the public interface, initializes the backend, then encapsulates some of the logic (such as message heartbeats) so the backends have less duplicated code. The backend is responsible for implementation-level details, such as how to store and retrieve messages and the queue cleanup jobs. The backend is specific to a data source, such as MySQL.

**** remove
DDQ is split into this core library and a backend. DDQ's job is to take messages and commands from the user and relays to the backend to do something. DDQ also handles certain business logic like being paused when too many messages are in flight or if the user wants to stop polling for a time. The backend has the job of doing what DDQ tells it to do, but could also be responsible for polling for messages emitting when it's found one and cleaning up tasks.
****


Usage
-----




Setting Up
----------

Setting up DDQ is pretty straight forward. It does require some configuration to get everything working together. Your project would need to include DDQ in it's `package.json` and also include a `backend` module or write one yourself. In the `config` value for `backend` this will set what module you're using. In the code this looks for `ddq-backend-whatYouHaveInConfigValueForBackend`. This should be in your `node_modules/` directory, so it's easily used.

Another config value is the `heartbeatDelay`. DDQ uses a method on the wrapped message, which we'll get to later. A heartbeat routine is called every so often to update the task/job in the queue currently being processed. The `heartbeatDelay` is configured in milliseconds, so a value of "1000" would have the heartbeat execute every second.

Also, servers might not be able to handle a certain number of processes, or you might only want to handle a few at a time, so setting the `maxProcessingMessages` to a number will make it so only up to that number of processes are created. DDQ will automatically tell the backend to pause the polling when this limit is reached. It will resume polling once the number of processing messages is lower than the max.

Other config values would be more specific for what your backend needs, like table name, how often to poll the storage mechanism and so on. These are passed to the backend using the `backendConfig` values.

    var DeDuplicatedQueue, instance;

    DeDuplicatedQueue = require("ddq");

    /* Pass in the config, including which backend to use and DDQ will find it
     * and use it.
     */
    instance = new DeDuplicatedQueue({
        backend: "mock",
        backendConfig: {
            host: "localhost",
            password: "someReallyNiceLongSecurePassword",
            pollingDelay: 5000,
            port: 3306,
            table: "query",
            user: "hopefullyNotRoot"
        },
        heartbeatDelay: 1000,
        maxProcessingMessages: 10
    });


Sending a Message
-----------------

A producer would be one to send a message. Using the `sendMessage` method you would send in the `message` you want to use and a `callback`. The callback is a way to handle when the `message` is successfully added to the queue, or not.

    instance.sendMessage("sample message", (err) => {
        if (err) {
            // Take action if there is an error.
        }
    });


Listening
---------

In order to receive messages from the queue, call `instance.listen()` and the instance will start to emit messages as they are found. DDQ will send two types of events: `data` and `error`. When `data` is emitted. you'll receive a message from the queue and a `callback` from DDQ. Once the process is complete you'll need to call the `callback` with an argument whether there was an error when processing.

When the `data` event is triggered from the backend DDQ will use methods on the data received from the `backend`. These methods include: `heartbeat`, `heartbeatKill`, `requeue`, and `remove`. The only piece of information the software running DDQ will receive is the message and the callback from DDQ in order to say whether the processing of the message was successful or not. When the message is being processed DDQ with call the `heartbeat` method on the `wrappedMessage` using `heartbeatDelay` from the config to tell the `backend` to update the heartbeat at that interval.

    // Starts listening for events.
    instance.listen();

    /* DDQ uses event emitters and you'll need to listen for them so your
     * applications can take actions.
     */
    instance.on("data", (message, callback) => {
        // Take action on the data.
        if (somethingBadHappened) {

            // Requeued for later processing.
            callback(new Error("Something bad happened"));
        } else {

            // Removed as message is no longer needed.
            callback();
        }
    });

The other event DDQ will emit is `error`. This alerts the code listening there was an error either coming from DDQ or passed back from the backend.

    instance.on("error", () => {
        // Take action on the error.
    });


Pausing and Resuming Polling
----------------------------

At some point your consumer might want to pause the polling of messages so it can do a task without having messages coming at it. You can do this by simply calling the DDQ method `instance.pausePolling()`. This doesn't use a `callback`, for if there is an error it should be emitted and picked up by the listener.

    // Tells the backend to stop polling.
    instance.pausePolling();

Once you feel you should resume polling you can call the `instance.resumePolling()` method. We don't want to resume polling if the limit has been reached. This also doesn't use a `callback`, for if there is an error it should be emitted and picked up by the listener.

    // Tells the backend to resume polling.
    instance.resumePolling();


Closing
-------

At some time you'll want to stop listening to DDQ which you will call `close`. This will call the backend to close it's connections and, stop polling for messages and stop emitting messages..

    // Stop listening to events and close the connection to the database.
    instance.close((err) => {
        if (err) {
            // Take action if there is an error.
        }
    });

[Code Coverage]: https://codecov.io/github/tests-always-included/ddq?branch=master
[codecov-image]: https://codecov.io/github/tests-always-included/ddq/coverage.svg?branch=master
[Dev Dependencies]: https://david-dm.org/tests-always-included/ddq#info=devDependencies
[devdependencies-image]: https://david-dm.org/tests-always-included/ddq/dev-status.png
[Dependencies]: https://david-dm.org/tests-always-included/ddq
[dependencies-image]: https://david-dm.org/tests-always-included/ddq.png
[travis-image]: https://secure.travis-ci.org/tests-always-included/ddq.png
[Travis CI]: http://travis-ci.org/tests-always-included/ddq
