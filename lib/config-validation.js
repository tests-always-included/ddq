"use strict";

module.exports = () => {
    /**
     * Checks the config has all necessary properties to work with the
     * backend-plugin. It will fail loudly if something isn't present.
     *
     * @param {Object} config
     * @param {Function} callback
     */
    function validateConfig(config) {
        var configKeys;

        if (typeof config !== "object") {
            throw new Error("Config must be an object.");
        }

        configKeys = {
            backend: "string",
            backendConfig: "object",
            heartbeatDelayMs: "number",
            maxProcessingMessages: "number"
        };

        Object.keys(configKeys).forEach((key) => {
            if (!config[key]) {
                throw new Error(`Config.${key} must be defined.`);
            } else if (typeof config[key] !== configKeys[key]) {
                throw new Error(`Config.${key} must be a ${configKeys[key]}`);
            }
        });
    }

    return {
        validateConfig
    };
};
