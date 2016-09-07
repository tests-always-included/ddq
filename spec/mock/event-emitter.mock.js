"use strict";


class EventEmitter {
    constructor() {
        [
            "addListener",
            "emit"
        ].forEach((methodName) => {
            this[methodName] = jasmine.createSpy(methodName);
        });
        addListener.andCallFake();
        emit.andCallFake();
    }
}

module.exports = EventEmitter;