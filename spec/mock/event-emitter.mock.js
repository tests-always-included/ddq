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
            "emit",
            "removeListener",
            "on"
        ].forEach((methodName) => {
            this[methodName] = jasmine.createSpy(methodName);
        });
        this.addListener.andCallFake(() => {});
        this.emit.andCallFake();
        this.removeListener.andCallFake(() => {});
        this.on.andCallFake();
    }
}

module.exports = EventEmitterMock;
