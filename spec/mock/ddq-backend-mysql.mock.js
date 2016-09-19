"use strict";

module.exports = function () {
    var mock;

    mock = jasmine.createSpyObj("mockBackend", [
        "close",
        "emit",
        "listen",
        "on",
        "pausePolling",
        "sendMessage",
        "requeue",
        "remove",
        "resumePolling"
    ]);
    mock.called = false;
    mock.close.andCallFake((callback) => {
        callback(null);
    });
    mock.listen.andCallFake(() => {
        mock.emit("data");
    });
    mock.on.andCallFake((event, callback) => {
        var params;

        switch (event) {
        case "data":
            params = {
                heartbeat: jasmine.createSpy("fasdfasd").andCallFake((hbCallback) => {
                    if (!mock.called) {
                        mock.called = true;
                        hbCallback(false);
                    }
                }),
                message: "someMessage",
                requeue: mock.requeue,
                remove: mock.remove
            };
            break;

        default:
            params = null;
            break;
        }

        return callback(params);
    });
    mock.sendMessage.andCallFake((message, callback) => {
        if (message === "messageFailure") {
            return callback(new Error("fasdfasd"));
        }

        return callback();
    });

    return mock;
};
