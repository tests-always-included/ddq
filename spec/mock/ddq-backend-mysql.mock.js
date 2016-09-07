"use strict";

module.exports = function () {
    var mock;

    mock = jasmine.createSpyObj("mockBackend", [
        "checkForData",
        "getWrappedMessage",
        "grabMessage",
        "sendMessage",
        "setHeartbeat"
    ]);
    mock.checkForData.andCallFake(() => {
        return true;
    });
    mock.getWrappedMessage.andCallFake(() => {
        return {
            id: "something"
        };
    });
    mock.grabMessage.andCallFake(() => {

    });
    mock.sendMessage.andCallFake(() => {

    });
    mock.setHeartbeat.andCallFake(() => {});

    return mock;
};
