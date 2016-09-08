"use strict";

describe("tests", () => {
    var config, Index, mock;

    mock = require("mock-require");
    beforeEach(() => {
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
    afterEach(() => {
        mock.stopAll();
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
        it("closes the polling of data", () => {
            // need to listen first.
            Ddq.listen();
            Ddq.close((error) => {
                expect(error).toBe(null);
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
        it("listens and gets data", () => {
            var listener;

            listener = Ddq.listen();
            listener.on("data", (blah) => {
                expect(blah).toBe(true);
            });
        });
        it("listens and does not get data", () => {
            var listener;

            mock.stop("ddq-backend-mysql");
            mock("ddq-backend-mysql", {
                checkForData: () => {
                    console.log('checkafsdfas');
                    return false;
                }
            });
            Index = mock.reRequire("../../lib/ddq");
            Ddq = new Index(config);
            listener = Ddq.listen();
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
        it("fails passes a message", () => {
            var Ddq;

            Ddq = new Index(config);

            mock("ddq-backend-mysql", {
                sendMessage: () => {
                    return false;
                }
            });
            Ddq.sendMessage("afsdfasdfasdfasdf", (error) => {
                expect(error).toEqual(Error("Problem with sending message to storage"));
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
        it("starts and fails", () => {
            var listener;

            mock.stop("ddq-backend-mysql");
            mock("ddq-backend-mysql", {
                setHeartbeat: () => {
                    return false;
                }
            });
            listener = Ddq.listen();
            Ddq.startHeartbeat("someRandomMessageIdHashFail");
            listener.on("error", (blah) => {
                expect(blah).toBe(true);
            });
        });
    });
});
