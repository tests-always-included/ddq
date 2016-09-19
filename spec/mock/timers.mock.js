"use strict";

var mock;

mock = jasmine.createSpyObj("mockTimers", [
    "clearInterval",
    "setInterval",
    "setTimeout",
    "clearTimeout"
]);
mock.clearInterval.andCallFake(() => {
    return null;
});
mock.setInterval.andCallFake((callback) => {
    callback(null);
});
mock.setTimeout.andCallFake((callback) => {
    callback();
});
mock.clearTimeout.andCallFake((callback) => {
    if (callback) {
        callback();
    }
});

module.exports = mock;
