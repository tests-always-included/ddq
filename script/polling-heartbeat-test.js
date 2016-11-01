"use strict";

var assert, config, Plugin;

assert = require("assert");
config = require("./manual-testing-config");
Plugin = require("..");


/**
 * Manual test for connect, listen, pausePolling, resumePolling, and disconnect,
 * in that order.
 */
function pollingTest() {
    var instance, instanceProperties;

    instance = new Plugin(config);
    instanceProperties = [
        "currentlyPolling",
        "poller",
        "restorer"
    ];

    /**
     * Assert properties in batches.
     *
     * @param {Array} properties
     * @param {*} [flag] If set, asserts true for falsy values
     */
    function assertProperties(properties, flag) {
        properties.forEach((property) => {
            if (flag) {
                assert(!instance[property]);
            } else {
                assert(instance[property]);
            }
        });
    }


    assertProperties(instanceProperties, true);
    console.log("Calling the listen method");
    instance.connect((connectErr) => {
        if (connectErr) {
            console.log("There was a connection error");
            throw new Error(connectErr);
        }

        console.log("Connection was successfully made");
        instance.startListening();
        setTimeout(() => {
            assertProperties(instanceProperties);
            instance.stopListening(() => {
                assertProperties(instanceProperties, true);
                instance.startListening();
                setTimeout(() => {
                    assertProperties(instanceProperties);
                    instance.stopListening(() => {
                        assertProperties(instanceProperties, true);
                        instance.disconnect((err) => {
                            if (err) {
                                console.log("There was a problem disconnecting");
                                throw new Error(err);
                            } else {
                                console.log("Disconnected successfully");
                            }
                        });
                    });
                }, 2000);
            });
        }, 2000);
    });
}

pollingTest();
