#!/usr/bin/env node

"use strict";

var config, DDQ, paramKey, testScenarios;

config = require("./manual-testing-config");
DDQ = require("..");
paramKey = {
    close: [
        (instance, test) => {
            console.log(`Running next: ${test}`);
            runCommands(instance, test);
        }
    ]
};
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
// function scenarioTest(test) {
//     var instance;
//
//     instance = new DDQ(config);
//     instance.on("error", (err) => {
//         console.log(err.message);
//     });
//     instance.on("data", (data) => {
//         console.log(data);
//     });
//     test.forEach((command) => {
//         instance[command](() => {
//             console.log(command);
//         });
//     });
//
// }
//
function runCommands(instance, test) {
    var mostRecentCommand;

    if (test.length) {
        // Remove the first command from test and set it to mostRecentCommand
        mostRecentCommand = test.shift();
    } else {
        console.log("Finished running commands.");

        return;
    }

    instance[mostRecentCommand].apply(null, paramKey[mostRecentCommand]);
}

function runner(tests) {
    tests.forEach((test) => {
        var instance;

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

        runCommands(instance, test);
    });
}

runner(testScenarios);


// var instance;
//
// instance = new DDQ(config);
//
// instance.on("error", (err) => {
//     console.log(err.message);
// });
//
// instance.on("data", (data) => {
//     console.log(data);
// });
//
// instance.open(() => {
//     instance.close();
// });
// instance.close();
