"use strict";

var config, DDQ, done, instance;

config = require("../script/manual-testing-config");
DDQ = require("..");

/* eslint-disable require-jsdoc */
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

    return (testComplete) => {
        args.unshift((err) => {
            if (err) {
                testComplete(err);
            } else {
                testComplete(new Error("methodFails was called. No error was passed along."));
            }
        });
        instance[method].apply(instance, args);
    };
}

function methodSucceeds() {
    var args, method;

    args = [].slice.call(arguments);
    method = args.shift();

    return (testComplete) => {
        args.unshift(testComplete);
        instance[method].apply(instance, args);
    };
}

function combine(list) {
    var remaining;

    remaining = list.length;

    return (testComplete) => {
        function singleTestDone(err) {
            console.log("inside singleTestDone, inside combine");
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

function cleanDatabase() {
    function errorHandler(err) {
        if (err) {
            console.log("There was an error during cleanup:", err);
        }
    }

    instance.open((err) => {
        errorHandler(err);

        instance.backend.connection.query(`
            TRUNCATE TABLE ??;`,
            [
                instance.backend.config.table
            ], (queryErr) => {
                errorHandler(queryErr);

                instance.backend.close(errorHandler);
            }
        );
    });
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

    it("opens once", (testComplete) => {
        tests = [
            methodSucceeds("open"),
            methodSucceeds("sendMessage", "message", "topic"),
            combine([
                methodSucceeds("sendMessage", "message2", "topic"),
                methodSucceeds("sendMessage", "message3", "topic")
            ]),
            methodFails("open")
        ];
        done = (err) => {
            expect(err.message).toBe("Could not send message.");
            testComplete();
            instance.backend.connection.destroy();
        };

        runTests(tests, done);
    });
    // it("opens", (testComplete) => {
    //     tests = [
    //         methodSucceeds("open")
    //     ];
    //     done = (err) => {
    //         expect(err).toBeUndefined();
    //         expect(instance.backend.connection).not.toBeUndefined();
    //         instance.backend.connection.destroy();
    //         testComplete();
    //     };
    //     runTests(tests, done);
    // });
    // it("opens and closes", (testComplete) => {
    //     tests = [
    //         methodSucceeds("open"),
    //         methodSucceeds("close")
    //     ];
    //     done = (err) => {
    //         expect(err).toBeUndefined();
    //         expect(instance.backend.connection).not.toBeUndefined();
    //         testComplete();
    //     };
    //     runTests(tests, done);
    // });
    // it("fails to open if there is already a connection", (testComplete) => {
    //     tests = [
    //         methodSucceeds("open"),
    //         methodFails("open")
    //     ];
    //     done = (err) => {
    //         expect(err.message).toBe("Could not open. DeDuplicated Queue is either busy or the connection to the database is already open.");
    //         expect(instance.backend.connection).not.toBeUndefined();
    //         instance.backend.connection.destroy();
    //         testComplete();
    //     };
    //     runTests(tests, done);
    // });
    // it("fails to close if there isn't a connection", () => {
    //     tests = [
    //         methodFails("close")
    //     ];
    //     done = (err) => {
    //         expect(instance.emit).toHaveBeenCalledWith("error", jasmine.any(Error));
    //         expect(err.message).toBe("Could not close. DeDuplicated Queue is either busy or the connection is already closed.");
    //     };
    //     runTests(tests, done);
    // });
    // it("fails to send a message if there isn't a connection", () => {
    //     tests = [
    //         methodFails("sendMessage")
    //     ];
    //     done = (err) => {
    //         expect(instance.emit).toHaveBeenCalledWith("error", jasmine.any(Error));
    //         expect(err.message).toBe("Could not send message. DeDuplicated Queue is either busy or the connection to the database is not open.");
    //     };
    //     runTests(tests, done);
    // });
    // it("fails to start listening if there isn't a connection", () => {
    //     tests = [
    //         methodFails("listenStart")
    //     ];
    //     done = (err) => {
    //         expect(instance.emit).toHaveBeenCalledWith("error", jasmine.any(Error));
    //         expect(err.message).toBe("Could not start listening. DeDuplicated Queue is either busy, does not have an open connection, or is already listening.");
    //     };
    //     runTests(tests, done);
    // });
    // it("fails to close the connection after already successfully closing", (testComplete) => {
    //     tests = [
    //         methodSucceeds("open"),
    //         methodSucceeds("close")
    //         // If we try to call close back to back, the nested callback
    //         // structure will prevent the connection from being destroyed before
    //         ,
    //         methodFails("close")
    //     ];
    //     done = (err) => {
    //         expect(instance.close.calls.length).toBe(2);
    //         expect(instance.emit).toHaveBeenCalledWith("error", jasmine.any(Error));
    //         expect(err.message).toBe("Could not close. DeDuplicated Queue is either busy or the connection is already closed.");
    //         testComplete();
    //     };
    //     runTests(tests, done);
    //     // runTests([
    //     //     methodFails("close")
    //     // ], () => {
    //     //
    //     // });
    // });
});
afterEach(() => {
    cleanDatabase();
});

// [
//     "open",
//     "sendMessage",
//     "listenStart",
//     "sendMessage",
//     "close"
// ]
// [
//     "open",
//     "listenStart",
//     "listenStart"
// ]
