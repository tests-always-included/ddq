"use strict";

var mock;

mock = jasmine.createSpyObj("mockTimers", [
    "setInterval",
    "clearInterval"
]);
mock.clearInterval.andCallFake(() => {
    return null;
});
mock.setInterval.andCallFake((callback) => {
    callback(null);
});


module.exports = mock;
