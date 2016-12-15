"use strict";

var config, DDQ, done, instance;

config = require("../script/manual-testing-config");
DDQ = require("ddq");


/**
 * Opens a connection to the database and deletes all entries.
 *
 * @param {Function} [callback]
 */
function cleanDatabase(callback) {
    /**
     * Logs errors passed in.
     *
     * @param {Error} err
     */
    function errorHandler(err) {
        if (err) {
            console.log("There was an error during cleanup:", err);
        }
    }

    instance.open((err) => {
        errorHandler(err);

        // This implementation is specific to the MySQL library.
        instance.backend.connection.query(`
            DELETE FROM ??`,
            [
                instance.backend.config.table
            ], (queryErr, data) => {
                errorHandler(queryErr);

                if (data) {
                    console.log("Records cleaned up:", data.affectedRows);
                }

                instance.close((endErr) => {
                    errorHandler(endErr);

                    if (callback) {
                        callback();
                    }
                });
            }
        );
    });
}


/**
 * Accepts an array of methods and done callback. Each method calls the
 * following method in it's callback unless there is an error, in which case the
 * done callback is invoked, breaking the flow.
 *
 * @param {array} methods
 * @param {Function} doneCb
 */
function runTests(methods, doneCb) {
    var nextMethod;

    if (!methods || !methods.length) {
        doneCb();

        return;
    }

    nextMethod = methods.shift();
    nextMethod((err) => {
        if (err) {
            doneCb(err);
        } else {
            runTests(methods, doneCb);
        }
    });
}


/**
 * Sets up methods for functional tests. Accepts any number of arguments. The
 * first argument is the name of the method to be called and the following
 * arguments (if any) are the parameters for the method. Returns a function that
 * will call the method with the arguments, as well as a callback.
 *
 * Use this when you expect that the method will fail.
 *
 * Example: methodFails("nameOfMethod", "param1", "param2", "param3");
 *
 * @return {Function}
 */
function methodFails() {
    var args, method;

    args = [].slice.call(arguments);
    method = args.shift();

    return (cb) => {
        args.unshift((err) => {
            if (err) {
                cb(err);
            } else {
                cb(new Error("methodFails was called. No error was passed along."));
            }
        });
        instance[method].apply(instance, args);
    };
}


/**
 * Sets up methods for functional tests. Accepts any number of arguments. The
 * first argument is the name of the method to be called and the following
 * arguments (if any) are the parameters for the method. Returns a function that
 * will call the method with the argments as well as a callback.
 *
 * Use this when you expect that the method will succeed.
 *
 * Example: methodSucceeds("nameOfMethod", "param1", "param2", "param3");
 *
 * @return {Function}
 */
function methodSucceeds() {
    var args, method;

    args = [].slice.call(arguments);
    method = args.shift();

    return (cb) => {
        args.unshift(cb);
        instance[method].apply(instance, args);
    };
}


/**
 * Calls a list of methods one after another. This is used for testing that
 * commands run as expected when they are not called in a reasoned, methodical
 * order (i.e. one method calls the next in its callback).
 *
 * Example:
 *   combine([
 *       methodSucceeds("firstMethod"),
 *       methodSucceeds("secondMethod"),
 *       methodFails("thirdMethod")
 *   ]);
 *
 * @param {array} list
 * @return {Function}
 */
function combine(list) {
    var remaining;

    remaining = list.length;

    return (testComplete) => {
        /**
         * The callback for each individual function in the list. Checks that
         * there is another function in the list and breaks the flow if there
         * isn't or if an error has occured.
         *
         * @param {Error} err
         */
        function singleTestDone(err) {
            if (!remaining) {
                return;
            }

            if (err) {
                remaining = 0;
                testComplete(err);
            } else {
                remaining -= 1;

                if (!remaining) {
                    testComplete();
                }
            }
        }

        list.forEach((fn) => {
            fn(singleTestDone);
        });
    };
}


beforeEach(() => {
    instance = new DDQ(config);
    instance.on("error", (err) => {
        done(err);
    });
    spyOn(instance, "close").andCallThrough();
    spyOn(instance, "listenStart").andCallThrough();
    spyOn(instance, "open").andCallThrough();
    spyOn(instance, "sendMessage").andCallThrough();
});
describe("DDQ", () => {
    var tests;

    it("opens", (testComplete) => {
        tests = [
            methodSucceeds("open")
        ];
        done = (err) => {
            expect(err).toBeUndefined();
            expect(instance.backend.connection).not.toBeUndefined();
            instance.backend.connection.destroy();
            testComplete();
        };
        runTests(tests, done);
    });
    it("opens and closes", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            methodSucceeds("close")
        ];
        done = (err) => {
            expect(err).toBeUndefined();
            testComplete();
        };
        runTests(tests, done);
    });
    it("fails to open if there is already a connection", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            methodFails("open")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not open.");
            expect(instance.open.calls.length).toBe(2);
            expect(instance.backend.connection.state).toBe("authenticated");
            instance.backend.connection.destroy();
            testComplete();
        };
        runTests(tests, done);
    });
    it("fails to close if there isn't a connection", () => {
        tests = [
            methodFails("close")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not close.");
            expect(instance.backend.connection).toBe(null);
        };
        runTests(tests, done);
    });
    it("fails to send a message if there isn't a connection", () => {
        tests = [
            methodFails("sendMessage")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not send message.");
            expect(instance.backend.connection).toBe(null);
        };
        runTests(tests, done);
    });
    it("fails to start listening if there isn't a connection", () => {
        tests = [
            methodFails("listenStart")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not start listening.");
            expect(instance.backend.connection).toBe(null);
        };
        runTests(tests, done);
    });
    it("fails to close the connection after already successfully closing", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            methodSucceeds("close"),
            methodFails("close")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not close.");
            expect(instance.close.calls.length).toBe(2);

            /**
             * Successfully ending the connection does not change the state of
             * an already opened connection. If there is an error while closing,
             * the connection's state should be "protocol_error" and if the
             * connection is destroyed (using the "destroy" method), the state
             * should be "disconnected".
            */
            expect(instance.backend.connection.state).toBe("authenticated");
            testComplete();
        };
        runTests(tests, done);
    });
    it("fails to call listenStart if listening is already occuring", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            methodSucceeds("listenStart"),
            methodFails("listenStart")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not start listening.");
            expect(instance.listenStart.calls.length).toBe(2);
            expect(instance.isListening).toBe(true);
            instance.close(() => {
                testComplete();
            });
        };
        runTests(tests, done);
    });
    it("handles multiple messages successfully", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            methodSucceeds("sendMessage", "message", "topic"),
            combine([
                methodSucceeds("sendMessage", "message2", "topic"),
                methodSucceeds("sendMessage", "message3")
            ]),
            methodFails("open")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not open.");
            expect(instance.backend.connection.state).toBe("authenticated");
            expect(instance.sendMessage.calls.length).toBe(3);
            instance.close(() => {
                cleanDatabase(testComplete);
            });
        };
        runTests(tests, done);
    });
    it("stops listening before closing", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            methodSucceeds("sendMessage", "message", "topic"),
            methodSucceeds("listenStart"),
            methodSucceeds("close")
        ];
        done = (err) => {
            expect(err).toBeUndefined();
            expect(instance.backend.connection.state).toBe("authenticated");
            expect(instance.isListening).toBe(false);
            cleanDatabase(testComplete);
        };
        runTests(tests, done);
    });
    it("fails to close if open is in progress", (testComplete) => {
        tests = [
            combine([
                methodSucceeds("open"),
                methodFails("close")
            ])
        ];
        done = (err) => {
            expect(err.message).toBe("Could not close.");
            instance.backend.connection.destroy();
            testComplete();
        };
        runTests(tests, done);
    });
    it("closes after all existing messages are handled", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            combine([
                methodSucceeds("sendMessage", "message2", "topic"),
                methodSucceeds("sendMessage", "message3"),
                methodSucceeds("close")
            ])
        ];
        done = (err) => {
            expect(err).toBeUndefined();
            expect(instance.sendMessage.calls.length).toBe(2);
            expect(instance.messagesInTransit).toBe(0);
            expect(instance.close).toHaveBeenCalled();
            expect(instance.backend.connection.state).toBe("authenticated");
            cleanDatabase(testComplete);
        };
        runTests(tests, done);
    });
});

