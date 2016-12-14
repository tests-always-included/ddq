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
        it("fails with error relayed from backend", (done) => {
            ddq.open();
            ddq.on("error", (err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
            ddq.listenStart();
            ddq.backend.emit("error", new Error("something"));
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
        it("sends successfully no callback or topic", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.open();
            ddq.sendMessage("message");
            done();
        });
        it("fails sending due to an error", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.open();
            ddq.busy = true;
            ddq.sendMessage((err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            }, "message", "topic");
        });
    });
});
