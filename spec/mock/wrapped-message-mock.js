"use strict";

var mock;

mock = jasmine.createSpyObj("wrappedMessageMock", [
    "heartbeat",
    "heartbeatKill",
    "remove",
    "requeue"
]);
mock.heartbeatError = false;
mock.heartbeatKillError = false;
mock.called = false;
mock.heartbeat.andCallFake((hbCallback) => {
    if (!mock.called) {
        mock.called = true;

        if (mock.heartbeatError) {
            hbCallback(new Error("Could not do heartbeat."));
        } else {
            hbCallback();
        }
    }
});
mock.message = "mock message";
module.exports = mock;
