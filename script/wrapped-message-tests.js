"use strict";

var assert, config, errCount, Plugin, runNext, testCounter, tests;

assert = require("assert");
config = require("./manual-testing-config");
errCount = 0;
Plugin = require("..");
testCounter = 0;
tests = [
    {
        name: "heartbeat",
        query: "INSERT INTO ?? (hash, isProcessing, owner, messageBase64) VALUES('123', true, ?, '456');"
    },
    {
        name: "requeue",
        query: "INSERT INTO ?? (hash, messageBase64) VALUES ('345', '789');"
    },
    {
        name: "remove",
        query: "INSERT INTO ?? (hash, requeued, owner, messageBase64) VALUES('456', false, ?, '789');"
    }
];


/**
 * A done callback that can be easily plugged into the various branches of the
 * other testing functions.
 *
 * @param {Object} err
 */
function doneCb(err) {
    if (err) {
        console.error("There was an error during test: ", tests[testCounter].name);
        console.error(err);
        errCount += 1;
    }
}


/**
 * Clears the database and severs the connection to the database.
 *
 * @param {Object} instance
 * @param {Function} done
 * @param {Function} [fn] The function that is to be tested.
 */
function cleanup(instance, done, fn) {
    instance.connection.query("DELETE FROM ??;",
        [
            instance.config.table
        ], (cleanupErr, data) => {
            if (cleanupErr) {
                console.error("There was a problem wiping the database.");
                console.error("Other tests may be affected by this failure.");
                done(cleanupErr);
            }

            instance.removeAllListeners();
            console.log("Cleanup was successful");

            // This should be 0 in the case of remove, which is why the assert
            // isn't run for remove.
            if (fn && (fn === "heartbeat" || fn === "requeue")) {
                assert(data.affectedRows);
            }

            instance.disconnect((err) => {
                if (err) {
                    done(err);
                }

                runNext(doneCb);
            });
        }
    );
}


/**
 * Inserts a record into the database using the provided query. On error, the
 * database is wiped and the error is handled. If successful, the polling is
 * initiated.
 *
 * @param {Object} instance
 * @param {string} query
 * @param {Function} done
 */
function prepTest(instance, query, done) {
    instance.connection.query(query,
        [
            instance.config.table,
            instance.owner
        ], (prepErr, prepData) => {
            if (prepErr) {
                done(prepErr);
                cleanup(instance, done);

                return;
            }

            console.log("CheckNow prep was successful", prepData);
            instance.startListening();
        }
    );
}


/**
 * Instantiates and preps the plugin for testing. The "data" event listener will
 * call the wrapped message function and initiate cleanup on success.
 *
 * @param {Function} fn The function that is to be tested.
 * @param {string} query
 * @param {Function} done
 */
function wrappedMessageTest(fn, query, done) {
    var instance;

    instance = new Plugin(config);
    instance.on("data", (data) => {
        console.log("CheckNow data listener activated.");
        instance.stopListening();
        data[fn]((err, fnData) => {
            if (err) {
                done(err);
            }

            console.log(`${fn} test was successful.`);
            console.log(`${fn} data:`);

            // This should be undefined for remove.
            console.log(fnData);
            cleanup(instance, done, fn);
        });
    });
    instance.on("error", (err) => {
        done(err);
        cleanup(instance, done);
    });
    instance.connect((err) => {
        if (err) {
            done(err);

            return;
        }

        prepTest(instance, query, done);
    });
}

runNext = function (done) {
    testCounter += 1;

    if (tests[testCounter]) {
        wrappedMessageTest(tests[testCounter].name, tests[testCounter].query, done);
    } else {
        assert(errCount, 0, `Error Count: ${errCount}`);
    }

    return;
};

wrappedMessageTest(tests[testCounter].name, tests[testCounter].query, doneCb);
