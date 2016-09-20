"use strict";

describe("tests", () => {
    var config, Ddq, events, timersMock;

    beforeEach(() => {
        events = require("events");
        timersMock = require("../mock/timers.mock");
        config = {
            backend: "mock",
            backendConfig: {
                pollingDelay: 5000
            },
            heartbeatDelay: 1000,
            maxProcessingMessages: 2
        };
        Ddq = require("../../lib/ddq")(events, timersMock);
    });
    describe(".constructor()", () => {
        it("can make a new DDQ", () => {
            expect(() => {
                // eslint-disable-next-line no-new
                new Ddq(config);
            }).not.toThrow();
        });
        it("fails because of no config being passed", () => {
            expect(() => {
                // eslint-disable-next-line no-new
                new Ddq();
            }).toThrow();
        });
    });
    describe(".close()", () => {
        beforeEach(() => {
            config.backendConfig.noPolling = true;
        });
        it("closes the polling of data", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.listen();
            ddq.close((err) => {
                expect(err).not.toBeDefined();
                done();
            });
        });
        it("fails closing the polling when calling backend to close", (done) => {
            var ddq;

            config.backendConfig.closeFail = true;
            ddq = new Ddq(config);
            ddq.listen();
            ddq.close((err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
        });
    });
    describe(".destroy()", () => {
        beforeEach(() => {
            config.backendConfig.noPolling = true;
        });
        it("calls the backend to close and is successful", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.backend.close = jasmine.createSpy("fasdfa");
            ddq.destroy();
            expect(ddq.backend.close).toHaveBeenCalled();
        });
        it("calls the backend to close and the backend fails", (done) => {
            var ddq;

            config.backendConfig.closeFail = true;
            ddq = new Ddq(config);
            ddq.on("error", (err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
            ddq.listen();
            ddq.destroy();
        });
    });
    describe(".listen()", () => {
        it("starts listening on the backend", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.backend.listen = jasmine.createSpy("backend.listen");
            ddq.listen();
            expect(ddq.backend.listen).toHaveBeenCalled();
        });
        it("reports failure when the backend has a problem", () => {
            // yeah
        });
    });
    describe("error event", () => {
        var ddq;

        beforeEach(() => {
            config.backendConfig.noPolling = true;
            ddq = new Ddq(config);
            ddq.listen();
        });
        it("is forwarded", (done) => {
            ddq.on("error", (err) => {
                expect(err).toBe("some error");
                done();
            });
            ddq.backend.emit("error", "some error");
        });
    });
    describe("data event", () => {
        var ddq, wrappedMessage;

        beforeEach(() => {
            config.backendConfig.noPolling = true;
            ddq = new Ddq(config);
            ddq.listen();
            wrappedMessage = require("../mock/wrapped-message-mock");
        });
        afterEach(() => {
            ddq.messagesBeingProcessed = 0;
            wrappedMessage = null;
        });
        it("requeues when polling was stopped and does not trigger a 'data' event", (done) => {
            var failed;

            failed = false;
            ddq.on("data", () => {
                // Should not ever call this
                failed = true;
            });
            ddq.pausePolling();
            ddq.backend.emit("data", wrappedMessage);
            expect(wrappedMessage.requeue).toHaveBeenCalled();
            expect(failed).toBe(false);
            done();
        });
        it("gets a bad heartbeat", (done) => {
            var errorCalled;

            errorCalled = false;
            ddq.on("error", () => {
                errorCalled = true;
                done();
            });
            ddq.on("data", (message, callback) => {
                callback(true);
                done();
            });
            wrappedMessage.heartbeatError = true;
            ddq.backend.emit("data", wrappedMessage);
            expect(wrappedMessage.requeue).toHaveBeenCalled();
            expect(errorCalled).toBe(true);
        });
        it("pauses when reaching its limit", (done) => {
            var emitted;

            emitted = false;
            ddq.backend.pausePolling = jasmine.createSpy("backend.pausePolling");
            ddq.on("data", (message, callback) => {
                emitted = true;
                expect(message).toBe("mock message");
                expect(callback).toEqual(jasmine.any(Function));
                done();
            });
            ddq.messagesBeingProcessed = 5;
            ddq.backend.emit("data", wrappedMessage);
            expect(ddq.backend.pausePolling).toHaveBeenCalled();
            expect(emitted).toBe(true);
            expect(wrappedMessage.requeue).toHaveBeenCalled();
            expect(wrappedMessage.remove).not.toHaveBeenCalled();
        });
        it("removes on success", (done) => {
            ddq.on("data", (message, callback) => {
                callback();
                done();
            });
            ddq.backend.emit("data", wrappedMessage);
            expect(wrappedMessage.remove).toHaveBeenCalled();
        });
        it("requeues on failure", (done) => {
            ddq.on("data", (message, callback) => {
                callback(true);
                done();
            });
            ddq.backend.emit("data", wrappedMessage);
            expect(wrappedMessage.requeue).toHaveBeenCalled();
        });
        it("resets the increment and does not resume polling", (done) => {
            ddq = null;

            ddq = new Ddq(config);
            ddq.messagesBeingProcessed = 1;
            ddq.isPausedByLimits = true;
            ddq.on("error", (callback) => {
                callback();
                done();
            });
            ddq.on("data", (message, callback) => {
                callback();
                done();
            });
            ddq.listen();
            ddq.backend.emit("data", wrappedMessage);
            expect(ddq.messagesBeingProcessed).toBe(1);
            expect(wrappedMessage.requeue).toHaveBeenCalled();
            expect(ddq.isPausedByLimits).toBe(false);
            done();
        });
        it("removes the message but emits the callback was done repeatedly", (done) => {
            ddq.on("error", (err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
            ddq.on("data", (message, callback) => {
                callback();
                callback();
                done();
            });
            ddq.backend.emit("data", wrappedMessage);
            expect(wrappedMessage.remove).toHaveBeenCalled();
        });
    });
    describe(".pausePolling()", () => {
        it("sets the flag indicating the user paused", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.pausePolling();
            expect(ddq.isPausedByUser).toBe(true);
        });
        it("tells the backend to pause", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.backend.pausePolling = jasmine.createSpy("ddq.backend.pausePolling");
            ddq.pausePolling();
            expect(ddq.backend.pausePolling).toHaveBeenCalled();
        });
    });
    describe(".resumePolling()", () => {
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
            ddq.backend.resumePolling = jasmine.createSpy("backend.resumePolling");
        });
        it("has conditions to resume polling", () => {
            ddq.pausePolling();
            expect(ddq.backend.resumePolling).not.toHaveBeenCalled();
            ddq.resumePolling();
            expect(ddq.backend.resumePolling).toHaveBeenCalled();
        });
        it("is paused by user and will not resume", () => {
            ddq.isPausedByUser = false;
            ddq.resumePolling();
            expect(ddq.backend.resumePolling).not.toHaveBeenCalled();
        });
        it("is paused by user and limits and will not resume", () => {
            ddq.isPausedByUser = true;
            ddq.isPausedByLimits = true;
            ddq.resumePolling();
            expect(ddq.backend.resumePolling).not.toHaveBeenCalled();
        });
    });
    describe(".sendMessage()", () => {
        it("sends successfully", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.sendMessage("message", (err) => {
                expect(err).not.toBeDefined();
                done();
            });
        });
        it("reports errors", (done) => {
            var ddq;

            config.backendConfig.sendFail = true;
            ddq = new Ddq(config);
            ddq.sendMessage("message", (err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
        });
    });
});
