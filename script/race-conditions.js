#!/usr/bin/env node

"use strict";

var config, DDQ, instance, testScenarios;

config = require("./manual-testing-config");
DDQ = require("..");
testScenarios = [
    // [
    //     "open",
    //     "close"
    // ]
    // ,
    // [
    //     "open",
    //     "open"
    // ]
    // ,
    // [
    //     "close"
    // ]
    // ,
    // [
    //     "sendMessage"
    // ]
    // ,
    [
        "open",
        "sendMessage",
        "listenStart",
        "sendMessage",
        "close"
    ]
    // ,
    // [
    //     "listenStart"
    // ]
    // ,
    // [
    //     "open",
    //     "listenStart",
    //     "listenStart"
    // ]
    // ,
    // [
    //     "open",
    //     "close",
    //     "close"
    // ]
];

/* eslint-disable require-jsdoc */
function runTests(tests, done) {
    var nextTest;

    if (!tests || !tests.length) {
        done();

        return;
    }

    nextTest = tests.shift();
    instance[nextTest]((err) => {
        if (err) {
            done(err);
        } else {
            runTests(tests, done);
        }
    });
}

function methodFails() {
    var args, method;

    args = [].prototype.slice.call(arguments);
    method = args.shift();

    return (testComplete) => {
        args.concat((err) => {
            if (err) {
                testComplete();
            } else {
                testComplete(new Error("humbug"));
            }
        });
        instance[method].apply(instance, args);
    };
}

function methodSucceeds() {
    var args, method;

    args = [].prototype.slice.call(arguments);
    method = args.shift();

    return (testComplete) => {
        args.concat(testComplete);
        instance[method].apply(instance, args);
    };
}

function done() {}
//
// function runner(tests) {
//     tests.forEach((functionSeries) => {
//         instance = new DDQ(config);
//         instance.on("error", () => {
//             if (instance.backend.connection) {
//                 instance.backend.connection.destroy();
//             } else {
//                 console.log("ERROR LISTENER ACTIVATED");
//             }
//         });
//         instance.on("data", (data) => {
//             console.log(data);
//         });
//
//         runTests(functionSeries, done);
//     });
// }

beforeEach(() => {
    instance = new DDQ(config);
    instance.on("error", () => {
        if (instance.backend.connection) {
            instance.backend.connection.destroy();
        } else {
            console.log("ERROR LISTENER ACTIVATED");
        }
    });
    instance.on("data", (data) => {
        console.log(data);
    });
});
it("", (testIsDone) => {
    var test;

    tests = methodSucceeds("open");

    runTest(test, testIsDone);
});

runner(testScenarios);

