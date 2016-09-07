"use strict";

describe("tests", () => {
    var config, Index;

    beforeEach(() => {
        var mock;

        mock = require("mock-require");
        mock("crypto", "../mock/crypto.mock");
        mock("events", "../mock/event-emitter.mock");
        mock("timers", "../mock/timers.mock");
        config = {
            backend: "mysql",
            pollingRate: 1000
        };
        Index = mock.reRequire("../../lib/ddq");
    });
    describe("can make and send message", () => {
        it("can make a new thing", () => {
            expect(() => {
                // eslint-disable-next-line no-unused-vars
                var Ddq;

                Ddq = new Index(config);
            }).not.toThrow();
        });
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
        it("fails because of no config being passed", () => {
            expect(() => {
                // eslint-disable-next-line no-unused-vars
                var Ddq;

                Ddq = new Index();
            }).toThrow("No Config was passed.");
        });
    });
    describe("checking listeners", () => {
        var Ddq;

        beforeEach(() => {
            Ddq = new Index(config);
        });
        it("fdaf", () => {
            Ddq.listen();
        });
    });
    describe("closing listeners", () => {
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
});
