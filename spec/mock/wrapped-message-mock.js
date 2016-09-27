"use strict";

module.exports = () => {
    var mock;

    mock = jasmine.createSpyObj("wrappedMessageMock", [
        "heartbeat",
        "remove",
        "requeue"
    ]);
    mock.heartbeat.andCallFake((hbCallback) => {
        if (mock.heartbeat.callCount === 1) {
            if (mock.heartbeatError) {
                hbCallback(new Error("Could not do heartbeat."));
            } else {
                hbCallback();
            }
        }
    });
    mock.heartbeatError = false;
    mock.message = "mock message";
    mock.remove.andCallFake(() => {});
    mock.requeue.andCallFake(() => {});

    return mock;
};
