"use strict";

describe("tests", () => {
    var config, Index;

    beforeEach(() => {
        var mock;

        mock = require("mock-require");
        mock("crypto", "../mock/crypto.mock");
        mock("events", "../mock/event-emitter.mock");
        mock("timers", "../mock/timers.mock");
        mock("ddq-backend-mysql", "../mock/ddq-backend-mysql.mock");
        config = {
            backend: "mysql",
            pollingRate: 5000,
            heartbeatRate: 1000
        };
        Index = mock.reRequire("../../lib/ddq");
    });
    describe(".constructor()", () => {
        it("can make a new DDQ", () => {
            expect(() => {
                // eslint-disable-next-line no-unused-vars
                var Ddq;

                Ddq = new Index(config);
            }).not.toThrow();
        });
        it("fails because of no config being passed", () => {
            expect(() => {
                // eslint-disable-next-line no-unused-vars
                var Ddq;

                Ddq = new Index();
            }).toThrow("No Config was passed.");
        });
    });
    describe(".close()", () => {
        var Ddq;

        beforeEach(() => {
            Ddq = new Index(config);
        });
        it("fdaf", () => {
            Ddq.listen();
            Ddq.close(() => {

            });
        });
    });
    describe(".finishMessage()", () => {
        var Ddq;

        beforeEach(() => {
            Ddq = new Index(config);
        });
        it("fdaf", () => {
            Ddq.finishMessage();
        });
    });
    describe(".getWrappedMessage()", () => {
        var Ddq;

        beforeEach(() => {
            Ddq = new Index(config);
        });
        it("fdaf", () => {
            Ddq.getWrappedMessage();
        });
    });
    describe(".grabMessage()", () => {
        var Ddq;

        beforeEach(() => {
            Ddq = new Index(config);
        });
        it("fdaf", () => {
            Ddq.grabMessage();
        });
    });
    describe(".listen()", () => {
        var Ddq;

        beforeEach(() => {
            Ddq = new Index(config);
        });
        it("fdaf", () => {
            Ddq.listen();
        });
    });
    describe(".sendMessage()", () => {
        it("fails not passing a message", () => {
            expect(() => {
                var Ddq;

                Ddq = new Index(config);
                Ddq.sendMessage();
            }).toThrow("No Message passed.");
        });
        it("successfully passes a message", () => {
            var Ddq;

            Ddq = new Index(config);
            Ddq.sendMessage("errorCreate", (error) => {
                expect(error).toEqual(Error("Could not create message"));
            });
        });
    });
    describe(".startHeartbeat()", () => {
        var Ddq;

        beforeEach(() => {
            Ddq = new Index(config);
        });
        it("starts and runs", () => {
            Ddq.listen();
            Ddq.startHeartbeat("someRandomMessageIdHash");
        });
    });
});
