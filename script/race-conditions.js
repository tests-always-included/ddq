#!/usr/bin/env node

"use strict";

var assert, config, Plugin, testScenarios;

assert = require("assert");
config = require("./manual-testing-config");
Plugin = require("..");
testScenarios = [
    [
        "open",
        "close"
    ], [
        "open",
        "open"
    ], [
        "close",
        "close"
    ], [
        "sendMessage"
    ], [
        "open",
        "sendMessage",
        "listenStart",
        "sendMessage",
        "close"
    ], [
        "listenStart"
    ], [
        "open",
        "listenStart",
        "listenStart"
    ], [
        "open",
        "close",
        "close"
    ]
];

/* eslint-disable require-jsdoc */
function scenarioTest(test) {
    var instance;

    instance = new Plugin(config);

    test.forEach((command) => {
        instance[command](() => {
            console.log(command);
        });
    });
}

function runner(tests) {
    tests.forEach((test) => {
        scenarioTest(test);
    });
}

runner(testScenarios);
