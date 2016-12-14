"use strict";

var config, DDQ, done, instance;

config = require("../script/manual-testing-config");
DDQ = require("..");

/* eslint-disable require-jsdoc */
function cleanDatabase(callback) {
    function errorHandler(err) {
        if (err) {
            console.log("There was an error during cleanup:", err);
        }
    }

    instance.open((err) => {
        errorHandler(err);

        instance.backend.connection.query(`
            DELETE FROM ??`,
            [
                instance.backend.config.table
            ], (queryErr, data) => {
                errorHandler(queryErr);

                console.log("Cleanup Data:");
                console.log(data);

                instance.backend.connection.end((endErr) => {
                    errorHandler(endErr);
                    callback();
                });
            }
        );
    });
}

function runTests(methods, doneCb) {
    var nextMethod;

    if (!methods || !methods.length) {
        doneCb();

        return;
    }

    nextMethod = methods.shift();
    nextMethod((err) => {
        if (err) {
            console.log("An error occurred in nextMethod callback", err);
            doneCb(err);
        } else {
            runTests(methods, doneCb);
        }
    });
}

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

function methodSucceeds() {
    var args, method;

    args = [].slice.call(arguments);
    method = args.shift();

    return (cb) => {
        args.unshift(cb);
        instance[method].apply(instance, args);
    };
}

function combine(list) {
    var remaining;

    remaining = list.length;

    return (testComplete) => {
        function singleTestDone(err) {
            if (!remaining) {
                return;
            }

            if (err) {
                // ABORT
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
        console.log("error listener called");
        done(err);
    });
    instance.on("data", (data) => {
        done(data);
    });
    spyOn(instance, "close").andCallThrough();
    spyOn(instance, "emit").andCallThrough();
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
            expect(instance.backend.connection).not.toBeUndefined();
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
            expect(instance.backend.connection).not.toBeUndefined();
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
        };
        runTests(tests, done);
    });
    it("fails to send a message if there isn't a connection", () => {
        tests = [
            methodFails("sendMessage")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not send message.");
        };
        runTests(tests, done);
    });
    it("fails to start listening if there isn't a connection", () => {
        tests = [
            methodFails("listenStart")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not start listening.");
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
            expect(instance.close.calls.length).toBe(2);
            expect(err.message).toBe("Could not close.");
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
            expect(instance.backend.connection).not.toBeUndefined();
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
            expect(instance.close).toHaveBeenCalled();
            cleanDatabase(testComplete);
        };
        runTests(tests, done);
    });
});
