"use strict";

var mock;

mock = jasmine.createSpyObj("timersMock", [
    "clearTimeout",
    "setTimeout"
]);
mock.clearTimeout.andCallFake((callback) => {
    if (callback) {
        callback();
    }
});
mock.setTimeout.andCallFake((callback) => {
    callback();
});
module.exports = mock;
