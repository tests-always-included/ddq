"use strict";

describe("tests", () => {
    var config, Ddq, eventsMock, mock, timersMock;

    mock = require("mock-require");
    beforeEach(() => {
        eventsMock = require("../mock/event-emitter.mock");
        timersMock = require("../mock/timers.mock");
        mock("ddq-backend-mysql", "../mock/ddq-backend-mysql.mock");
        config = {
            backend: "mysql",
            backendConfig: {
                pollingDelay: 5000
            },
            heartbeatDelay: 1000,
            maxProcessingMessages: 2
        };
        Ddq = require("../../lib/ddq")(eventsMock, timersMock);
    });
    describe(".constructor()", () => {
        it("can make a new DDQ", () => {
            expect(() => {
                // eslint-disable-next-line no-unused-vars
                var ddq;

                ddq = new Ddq(config);
            }).not.toThrow();
        });
        it("fails because of no config being passed", () => {
            expect(() => {
                // eslint-disable-next-line no-unused-vars
                var ddq;

                ddq = new Ddq();
            }).toThrow();
        });
    });
    describe(".close()", () => {
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
        });
        it("closes the polling of data", () => {
            ddq.listen();
            ddq.close((error) => {
                expect(error).toBe(null);
            });
        });
        it("fails closing the polling when calling backend to close", () => {
            ddq.backend.close.andCallFake((callback) => {
                callback(true);
            });
            ddq.listen();
            ddq.close((error) => {
                expect(error).toBe(true);
            });
        });
    });
    describe(".destroy()", () => {
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
        });
        it("calls the backend to close and is successful", () => {
            ddq.destroy();
            expect(ddq.backend.close).toHaveBeenCalled();
        });
        it("calls the backend to close and the backend fails", () => {
            ddq.backend.close.andCallFake((callback) => {
                return callback(new Error("There was a problem."));
            });
            ddq.destroy();
            expect(ddq.backend.close).toHaveBeenCalled();
        });
    });
    describe(".listen()", () => {
        var called, ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
            called = false;
        });
        afterEach(() => {
            ddq.messagesBeingProcessed = 0;
        });
        it("reached its limit", () => {
            ddq.messagesBeingProcessed = 5;
            ddq.backend.on.andCallFake((params, callback) => {
                return callback({
                    message: "message 1",
                    heartbeat: jasmine.createSpy("fasdfa").andCallFake((hbCallback) => {
                        if (!called) {
                            called = true;
                            hbCallback(new Error("fasdfasd"));
                        }
                    }),
                    remove: ddq.backend.remove
                });
            });
            ddq.listen();
            expect(ddq.backend.pausePolling).toHaveBeenCalled();
            expect(ddq.backend.remove).toHaveBeenCalled();
        });
        it("resets the increment", () => {
            ddq.messagesBeingProcessed = 1;
            ddq.isPausedByUser = false;
            ddq.isPausedByLimits = true;
            ddq.listen();
            expect(ddq.messagesBeingProcessed).toBe(1);
            expect(ddq.backend.resumePolling).not.toHaveBeenCalled();
            expect(ddq.backend.remove).toHaveBeenCalled();
        });
        // Primarily in place to make sure we get all coverage
        it("resets the increment and does not resume polling", () => {
            ddq.messagesBeingProcessed = 1;
            ddq.isPausedByUser = true;
            ddq.isPausedByLimits = true;
            ddq.listen();
            expect(ddq.messagesBeingProcessed).toBe(1);
            expect(ddq.backend.resumePolling).not.toHaveBeenCalled();
            expect(ddq.backend.remove).toHaveBeenCalled();
        });
    });
    describe(".pausePolling()", () => {
        it("in calling the pause functionality", () => {
            var ddq;

            ddq = new Ddq(config);
            ddq.pausePolling();
        });
    });
    describe(".resumesPolling()", () => {
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
        });
        it("has conditions to resume polling", () => {
            ddq.isPausedByUser = true;
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
        var ddq;

        beforeEach(() => {
            ddq = new Ddq(config);
        });
        it("sends successfully", () => {
            ddq.sendMessage("messageSuccess", (err) => {
                expect(err).toEqual();
            });
        });
        it("does not send successfully", () => {
            ddq.sendMessage("messageFailure", (err) => {
                expect(err).toEqual(jasmine.any(Error));
            });
        });
    });
});
