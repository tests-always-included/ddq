"use strict";

var mock;

mock = jasmine.createSpyObj("mockTimers", [
    "clearInterval",
    "clearTimeout",
    "setInterval",
    "setTimeout"
]);
mock.clearInterval.andCallFake((callback) => {
    if (callback) {
        callback();
    }
});
mock.clearTimeout.andCallFake((callback) => {
    if (callback) {
        callback();
    }
});
mock.setInterval.andCallFake((callback) => {
    callback();
});
mock.setTimeout.andCallFake((callback) => {
    callback();
});

module.exports = mock;
