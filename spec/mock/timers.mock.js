"use strict";

var mock;

mock = jasmine.createSpyObj("mockTimers", [
    "setInterval",
    "clearInterval"
]);

mock.setInterval.andReturn(true);

module.exports = mock;
