"use strict";

var config, Plugin;

config = require("./manual-testing-config");
Plugin = require("..");


/**
 * Easily plugable callback, which will throw any errors it receives.
 *
 * @param {Object} err
 * @throw {Error} Throws any error passed in.
 */
function doneCb(err) {
    if (err) {
        console.log("sendMessage test failed");
        throw new Error(err);
    } else {
        console.log("sendMessage test passed");
    }
}


/**
 * Instantiate a Plugin and call the passed function after establishing a
 * connection. Call the done callback on any returned values and disconnect on
 * success.
 *
 * @param {Function} fn The function that is being tested.
 * @param {Function} done An error handling function. Will log on success.
 */
function manualTest(fn, done) {
    var fnCallTime, instance;

    instance = new Plugin(config);
    instance.connect((connectErr) => {
        if (connectErr) {
            console.error("There was a connection error");
            done(connectErr);

            return;
        }

        console.log("Connection was successfully made");
        fnCallTime = Date.now() / 1000;
        console.log(fnCallTime, "- Calling sendMessage now");
        fn(instance, (testErr) => {
            if (testErr) {
                done(testErr);

                return;
            }

            console.log("sendMessage completed. Time difference between time of call and completion:", Date.now() / 1000 - fnCallTime);
            instance.disconnect(done);
        });
    });
}

manualTest((instance, done) => {
    instance.sendMessage("Test Message", "Test Topic", done);
}, doneCb);

setTimeout(() => {
    manualTest((instance, done) => {
        instance.startListening();
        instance.sendMessage("Test Message", "Test Topic", done);
        instance.stopListening();
    }, doneCb);
}, 3000);

