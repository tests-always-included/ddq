"use strict";

describe("tests", () => {
    var config, configValidatorMock, Ddq, events, timersMock;

    configValidatorMock = jasmine.createSpyObj("configValidatorMock", [
        "validateConfig"
    ]);
    events = require("events");
    timersMock = require("../mock/timers-mock");
    beforeEach(() => {
        config = {
            backend: "mock",
            backendConfig: {
                pollingDelayMs: 5000
            },
            heartbeatDelayMs: 1000,
            createMessageCycleLimit: 2
        };
        Ddq = require("../../lib/ddq")(configValidatorMock, events, timersMock);
    });
    describe(".constructor()", () => {
        it("can make a new DDQ", () => {
            expect(() => {
                return new Ddq(config);
            }).not.toThrow();
        });
        it("fails because of no config being passed", () => {
            expect(() => {
                return new Ddq();
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
            ddq.open();
            ddq.close((err) => {
                expect(err).not.toBeDefined();
                done();
            });
        });
        it("fails closing the polling when calling backend to close", (done) => {
            var ddq;

            config.backendConfig.closeFail = true;
            ddq = new Ddq(config);
            ddq.open();
            ddq.close((err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
        });
        it("closes the polling without a callback", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.open();
            ddq.close();
        });
    });
    describe(".connect()", () => {
        it("calls the error callback", () => {
            var ddq;

            ddq = new Ddq(config);
            spyOn(console, "error");
            spyOn(ddq.backend, "connect").andCallFake((callback) => {
                callback({
                    message: "SomeError"
                });
            });
            ddq.connect((err) => {
                console.error(err.message);
            }, () => {});
            expect(console.error).toHaveBeenCalledWith("SomeError");
        });
        it("calls the success callback if there is already a connection", () => {
            var ddq;

            ddq = new Ddq(config);
            spyOn(console, "error");
            ddq.backend.connection = true;
            ddq.connect((err) => {
                console.error(err.message);
            }, () => {});
            expect(console.error).not.toHaveBeenCalledWith("SomeError");
        });
    });
    describe(".open()", () => {
        it("starts listening on the backend", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.backend.startListening = jasmine.createSpy("ddq.backend.startListening");
            ddq.open();
            expect(ddq.backend.startListening).toHaveBeenCalled();
        });
    });
    describe("EventEmitter", () => {
        var ddq, wrappedMessage;

        beforeEach(() => {
            wrappedMessage = require("../mock/wrapped-message-mock")();
            config.backendConfig.noPolling = true;
            ddq = new Ddq(config);
            ddq.open();
        });
        describe("data event", () => {
            it("requeues when polling was stopped and does not trigger a 'data' event", (done) => {
                ddq.on("data", jasmine.fail);
                wrappedMessage.requeue.andCallFake(() => {
                    done();
                });
                ddq.pauseListening();
                ddq.backend.emit("data", wrappedMessage);
            });
            it("pauses when reaching its limit", (done) => {
                var emitted;

                emitted = false;
                spyOn(ddq.backend, "stopListening").andCallThrough();
                ddq.on("data", (message, callback) => {
                    emitted = true;
                    expect(message).toBe("mock message");
                    expect(callback).toEqual(jasmine.any(Function));
                    expect(ddq.backend.stopListening).toHaveBeenCalled();
                    expect(emitted).toBe(true);
                    expect(wrappedMessage.requeue).not.toHaveBeenCalled();
                    expect(wrappedMessage.remove).not.toHaveBeenCalled();
                    ddq.close();
                    done();
                });
                ddq.messagesBeingProcessed = 5;
                ddq.backend.emit("data", wrappedMessage);
            });
            it("removes on success", (done) => {
                ddq.on("data", (message, callback) => {
                    callback();
                    expect(wrappedMessage.remove).toHaveBeenCalled();
                    ddq.close();
                    done();
                });
                ddq.backend.emit("data", wrappedMessage);
            });
            it("requeues on failure", (done) => {
                ddq.on("data", (message, callback) => {
                    callback(true);
                    expect(wrappedMessage.requeue).toHaveBeenCalled();
                    ddq.close();
                    done();
                });
                ddq.backend.emit("data", wrappedMessage);
            });
            it("resumes polling after processes count is under the limit again", (done) => {
                ddq.messagesBeingProcessed = 1;
                ddq.isPausedByLimits = true;
                ddq.on("data", (message, callback) => {
                    callback();
                    expect(ddq.messagesBeingProcessed).toBe(1);
                    expect(wrappedMessage.remove).toHaveBeenCalled();
                    expect(ddq.isPausedByLimits).toBe(false);
                    done();
                });
                ddq.backend.emit("data", wrappedMessage);
            });
            it("requeues when too many processes are going", (done) => {
                ddq.messagesBeingProcessed = 5;
                ddq.isPausedByLimits = false;
                ddq.on("data", (message, callback) => {
                    callback();
                    expect(ddq.messagesBeingProcessed).toBe(5);
                    expect(ddq.isPausedByLimits).toBe(true);
                    done();
                });
                ddq.backend.emit("data", wrappedMessage);
            });
            it("sets isPausedByUser in the process of doing a heartbeat", (done) => {
                wrappedMessage.heartbeat = jasmine.createSpy("wrappedMessage.heartbeat")
                    .andCallFake((hbCallback) => {
                        ddq.isPausedByUser = true;
                        if (wrappedMessage.heartbeat.callCount === 1) {
                            hbCallback();
                        }
                    });
                ddq.messagesBeingProcessed = 1;
                ddq.isPausedByLimits = false;
                ddq.on("data", (message, callback) => {
                    callback();
                    expect(ddq.messagesBeingProcessed).toBe(1);
                    expect(wrappedMessage.remove).toHaveBeenCalled();
                    expect(ddq.isPausedByLimits).toBe(false);
                    done();
                });
                ddq.backend.emit("data", wrappedMessage);
            });
            it("removes the message but emits that the callback was done repeatedly", (done) => {
                ddq.on("error", (err) => {
                    expect(err).toEqual(jasmine.any(Error));
                    done();
                });
                ddq.on("data", (message, callback) => {
                    callback();
                    callback();
                    ddq.close();
                });
                ddq.backend.emit("data", wrappedMessage);
                expect(wrappedMessage.remove).toHaveBeenCalled();
            });
        });
        describe("error event", () => {
            it("is forwarded", (done) => {
                ddq.on("error", (err) => {
                    expect(err).toBe("some error");
                    ddq.close();
                    done();
                });
                ddq.backend.emit("error", "some error");
            });
        });
    });
    describe("heartbeat", () => {
        var ddq, errorCalled, wrappedMessage;

        beforeEach(() => {
            errorCalled = false;
            config.backendConfig.noPolling = true;
            wrappedMessage = require("../mock/wrapped-message-mock")();
            ddq = new Ddq(config);
            ddq.open();
        });
        it("gets a good heartbeat", (done) => {
            ddq.on("data", (message, callback) => {
                callback();
                expect(wrappedMessage.heartbeat).toHaveBeenCalled();
                expect(wrappedMessage.remove).toHaveBeenCalled();
                ddq.close();
                done();
            });
            ddq.backend.emit("data", wrappedMessage);
        });
        it("gets a bad heartbeat", (done) => {
            ddq.on("error", () => {
                errorCalled = true;
            });
            ddq.on("data", (message, callback) => {
                callback();
                expect(wrappedMessage.heartbeat).toHaveBeenCalled();
                expect(wrappedMessage.remove).toHaveBeenCalled();
                expect(errorCalled).toBe(true);
                ddq.close();
                done();
            });
            wrappedMessage.heartbeatError = true;
            ddq.backend.emit("data", wrappedMessage);
        });

        // Primarily for coverage of branches.
        it("gets a heartbeat where false was passed to callback", (done) => {
            wrappedMessage.heartbeat = jasmine.createSpy("wrappedMessage.heartbeat")
                .andCallFake((hbCallback) => {
                    if (!wrappedMessage.heartbeat.callCount) {
                        hbCallback(false);
                    }
                });
            ddq.on("data", (message, callback) => {
                callback(true);
                expect(wrappedMessage.requeue).toHaveBeenCalled();
                ddq.close();
                done();
            });
            wrappedMessage.heartbeatError = true;
            ddq.backend.emit("data", wrappedMessage);
        });
    });
    describe(".pausePolling()", () => {
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
            ddq.backend.startListening = jasmine.createSpy("ddq.backend.startListening");
            ddq.backend.stopListening = jasmine.createSpy("ddq.backend.stopListening");
        });
        it("sets the flag indicating the user paused polling", () => {
            ddq.open();
            ddq.pauseListening();
            expect(ddq.isPausedByUser).toBe(true);
            expect(ddq.backend.stopListening).toHaveBeenCalled();
        });
        it("does not pause when not listening", () => {
            ddq.pauseListening();
            expect(ddq.isPausedByUser).toBe(false);
            expect(ddq.backend.stopListening).not.toHaveBeenCalled();
        });
    });
    describe(".resumeListening()", () => {
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
            ddq.backend.startListening = jasmine.createSpy("ddq.backend.startListening");
            ddq.backend.stopListening = jasmine.createSpy("ddq.backend.stopListening");
            ddq.open(() => {});
        });
        it("has conditions to resume polling", () => {
            ddq.pauseListening();
            ddq.resumeListening();
            expect(ddq.backend.startListening.callCount).toBe(2);
        });
        it("is paused by user and will not resume", () => {
            ddq.isPausedByUser = false;
            ddq.resumeListening();
            expect(ddq.backend.startListening.callCount).toBe(1);
        });
        it("is paused by user and limits and will not resume", () => {
            ddq.isPausedByUser = true;
            ddq.isPausedByLimits = true;
            ddq.resumeListening();
            expect(ddq.backend.startListening.callCount).toBe(1);
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
        it("reports errors", () => {
            var ddq;

            config.backendConfig.sendFail = true;
            ddq = new Ddq(config);
            ddq.sendMessage("message");
        });
    });
});
