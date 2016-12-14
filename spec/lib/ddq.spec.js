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
            maxProcessingMessages: 2
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
        it("attempts to close with no connection open", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.close(() => {
                expect(ddq.closeCallback).not.toEqual(jasmine.any(Function));
            });
        });
        it("closes while listening", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.isListening = true;
            ddq.open();
            spyOn(ddq.backend, "stopListening").andCallThrough();
            ddq.close(() => {
                expect(ddq.backend.stopListening).toHaveBeenCalled();
            });
        });
    });
    describe(".open()", () => {
        it("starts listening on the backend", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.backend.connect = jasmine.createSpy("ddq.backend.connect");
            ddq.open();
            expect(ddq.backend.connect).toHaveBeenCalled();
        });
        it("Fails to open a connection.", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.busy = true;
            ddq.open((err) => {
                expect(err).toEqual(jasmine.any(Error));
            });
        });
    });

    /* describe("EventEmitter", () => {
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
            it("stops when reaching its limit", (done) => {
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
                    done();
                });
                ddq.messagesBeingProcessed = 5;
                ddq.maxProcessingMessages = 4;
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
    }); */

    describe(".listenStart()", () => {
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
            timersMock.setTimeout = jasmine.createSpy("timeout");
            spyOn(ddq.backend, "startListening");
            ddq.backend.storedData = [
                {
                    id: 0,
                    isProcessing: false,
                    requeded: false,
                    owner: null
                },
                {
                    id: 1,
                    isProcessing: false,
                    requeded: false,
                    owner: null
                }
            ];
        });
        it("ddq is busy and fails to start connection", () => {
            ddq.open();
            ddq.busy = true;
            ddq.listenStart((err) => {
                expect(err).toEqual(jasmine.any(Error));
            });
        });
        it("starts connection", (done) => {
            ddq.open();
            ddq.on("data", (msg, callback) => {
                callback();
                expect(ddq.backend.startListening).toHaveBeenCalled();
                done();
            });
            ddq.listenStart();
            ddq.backend.checkAndEmitData();
        });
        it("message is requeued due to error", (done) => {
            var err;

            ddq.open();
            ddq.on("data", (msg, callback) => {
                err = new Error("Cray cray");
                callback(err);
                done();
            });
            ddq.listenStart();
            ddq.backend.checkAndEmitData();
        });
        it("duplicate calls to done", (done) => {
            ddq.open();
            ddq.on("data", (msg, callback) => {
                callback();
                callback();
            });
            ddq.on("error", (err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
            ddq.listenStart();
            ddq.backend.checkAndEmitData();
        });
    });
    describe(".sendMessage()", () => {
        it("sends successfully", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.open();
            ddq.sendMessage((err) => {
                expect(err).not.toBeDefined();
                done();
            }, "message", "topic");
        });
        it("reports errors", (done) => {
            var ddq;

            config.backendConfig.sendFail = true;
            ddq = new Ddq(config);
            ddq.open();
            ddq.sendMessage((err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            }, "message", "topic");
        });
    });
});
