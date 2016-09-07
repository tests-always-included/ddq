"use strict";

var mock;

mock = jasmine.createSpyObj("cryptoMock", [
    "createHash",
    "digest",
    "update"
]);
mock.createHash.andCallFake((message) => {
    return {
        update: mock.update
    };
});
mock.digest.andReturn("fasdfasd");
mock.update.andCallFake((message) => {
    if (message === "errorCreate") {
        throw new Error("fdafs");
    }

    return {
        digest: mock.digest
    };
});

module.exports = mock;