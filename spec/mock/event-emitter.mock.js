"use strict";

/**
 * Mock EventEmitter.
 */
class EventEmitterMock {
    /**
     * Constructor for Mock EventEmitter.
     */
    constructor() {
        [
            "addListener",
            "emit"
        ].forEach((methodName) => {
            this[methodName] = jasmine.createSpy(methodName);
        });
        this.addListener.andCallFake();
        this.emit.andCallFake();
    }
}

module.exports = EventEmitterMock;
