"use strict";

var crypto, EventEmitter;

crypto = require("crypto");
EventEmitter = require("events");
const EMIT_DATA = "data", EMIT_ERROR = "error";

/**
 * Class for DDQ.
 */
class Ddq {
    /**
     * @param {Object} config
     * @throws {Error} when a config is not found
     */
    constructor(config) {
        if (!config) {
            throw new Error("No Config was passed.");
        }

        // Require the backend
        this.backend = require(`ddq-backend-${config.backend}`)();
        this.listener = null;
        this.polling = null;
        this.pollingRate = config.pollingRate;
    }


    /**
     * Checks to see if the storage mechanism has data.
     *
     * @return {*}
     */
    checkForData() {
        return this.backend.checkForData();
    }


    /**
     * Gets data from the backend storage
     *
     * @return {Object}
     */
    getMessage() {
        return this.backend.getMessage();
    }

    /**
     * Starts the polling and emits when data changes or an error happens.
     *
     * @return {EventEmitter}
     */
    listen() {
        this.listener = new EventEmitter();
        this.listener.addListener(EMIT_DATA, () => {});
        this.listener.addListener(EMIT_ERROR, () => {});
        this.startPolling();

        return this.listener;
    }


    /**
     * Pauses the polling for until started up again. This
     * can be used if the consumer needs to take care of something
     * and doesn't want events to be emiited for a time.
     */
    pausePolling() {
        clearInterval(this.polling);
        this.polling = null;
    }


    /**
     * Sends the message to the backend.
     *
     * @param {*} message
     * @return {boolean}
     * @throws {Error} when no message is passed
     */
    sendMessage(message) {
        if (!message) {
            throw new Error("No Message passed.");
        }

        return crypto.createHash("sha256").update(message).digest("hex");
    }


    /**
     * Starts polling to see if there is data. When data is found we emits
     * the "data" event;
     */
    startPolling() {
        this.polling = setInterval(() => {
            if (this.checkForData()) {
                this.listener.emit(EMIT_DATA);
            }
        }, this.pollingRate);
    }


    /**
     * Kills the listeners and polling.
     */
    stop() {
        EventEmitter.removeListener(EMIT_DATA, this.listener);
        clearInterval(this.polling);
        this.polling = null;
    }
}

module.exports = Ddq;
