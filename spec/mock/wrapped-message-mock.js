"use strict";

var mock;

mock = jasmine.createSpyObj("wrappedMessageMock", [
    "heartbeat",
    "requeue",
    "remove"
]);
mock.heartbeatError = false;
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
mock.requeue.andCallFake(() => {
});
mock.remove.andCallFake(() => {
});
module.exports = mock;
