"use strict";

var mock;

mock = jasmine.createSpyObj("timersMock", [
    "clearTimeout",
    "setTimeout"
]);
mock.clearTimeout.and.callFake((callback) => {
    if (callback) {
        callback();
    }
});
mock.setTimeout.and.callFake((callback) => {
    callback();
});
module.exports = mock;
