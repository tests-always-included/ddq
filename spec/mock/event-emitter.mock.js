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
        this.emit.andCallFake((event, params, callback) => {
            if (typeof params === "function") {
                callback = params;
            }

            if (callback && typeof callback === "function") {
                callback();
            }
        });
        this.removeListener.andCallFake(() => {});
        this.on.andCallFake((event, callback) => {
            callback(true);
        });
    }
}

module.exports = EventEmitterMock;
