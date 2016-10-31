"use strict";

describe("lib/config-validation", () => {
    var config, configValidation;

    beforeEach(() => {
        configValidation = require("../../lib/config-validation.js")();
        spyOn(configValidation, "validateConfig").andCallThrough();
    });
    describe(".validateConfig()", () => {
        it("throws an error if the config is not an object", () => {
            config = false;
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("throws an error if any of the configKeys are missing", () => {
            config = {
                backend: "SomeBackend",
                createMessageCycleLimit: 10,
                heartbeatDelayMs: 1000
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("throws if required config values are of the wrong type", () => {
            config = {
                backend: "SomeBackend",
                createMessageCycleLimit: {
                    limit: 10
                },
                heartbeatDelayMs: 1000,
                backendConfig: {
                    host: "SomeHost",
                    database: "SomeDatabase"
                }
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).toThrow();
        });
        it("doesn't throw when given a valid config", () => {
            config = {
                backend: "SomeBackend",
                createMessageCycleLimit: 10,
                heartbeatDelayMs: 5000,
                backendConfig: {
                    host: "SomeHost",
                    database: "SomeDatabase"
                }
            };
            expect(() => {
                configValidation.validateConfig(config);
            }).not.toThrow();
        });
    });
});
