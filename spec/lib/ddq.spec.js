"use strict";

describe("DDQ", () => {
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
                done(err);
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
            spyOn(ddq.backend, "stopListening").and.callThrough();
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
        it("fails to open a connection.", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.isBusy = true;
            ddq.open((err) => {
                expect(err).toEqual(jasmine.any(Error));
            });
        });
    });
    describe(".listenStart()", () => {
        var ddq, wmMock;

        beforeEach(() => {
            ddq = new Ddq(config);
            timersMock.setTimeout = jasmine.createSpy("timeout");
            spyOn(ddq.backend, "startListening").and.callThrough();
            wmMock = require("../mock/wrapped-message-mock")();
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
                },
                {
                    id: 2,
                    isProcessing: false,
                    requeded: false,
                    owner: null
                }
            ];
        });
        it("ddq is busy and fails to start connection", () => {
            ddq.open();
            ddq.isBusy = true;
            ddq.listenStart((err) => {
                expect(err).toEqual(jasmine.any(Error));
            });
        });
        it("starts connection", (done) => {
            var called;

            called = false;

            timersMock.setTimeout.and.callFake((callback) => {
                if (!called) {
                    called = true;
                    callback();
                }
            });
            ddq.open();
            ddq.on("data", (msg, callback) => {
                callback();
                expect(ddq.backend.startListening).toHaveBeenCalled();
                done();
            });
            ddq.listenStart();
            ddq.backend.checkAndEmitData();
        });
        it("healthcheck fails.", (done) => {
            var called;

            called = false;

            timersMock.setTimeout.and.callFake((callback) => {
                if (!called) {
                    called = true;
                    callback();
                }
            });
            ddq.open();
            ddq.on("error", () => {
                expect(ddq.backend.startListening).toHaveBeenCalled();
                done();
            });
            ddq.listenStart();
            wmMock.heartbeat.and.callFake((callback) => {
                callback(new Error("err"));
            });
            ddq.backend.emit("data", wmMock);
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
            ddq.sendMessage("message", "topic", (err) => {
                expect(err).not.toBeDefined();
                done();
            });
        });
        it("sends successfully no callback or topic", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.open();
            ddq.sendMessage("message");
            done();
        });
        it("sends successfully no topic", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.open();
            ddq.sendMessage("message", (err) => {
                done(err);
            });
        });
        it("fails sending due to an error", (done) => {
            var ddq;

            ddq = new Ddq(config);
            ddq.open();
            ddq.isBusy = true;
            ddq.sendMessage("message", "topic", (err) => {
                expect(err).toEqual(jasmine.any(Error));
                done();
            });
        });
    });
});
