"use strict";

var crypto, EventEmitter, timers;

crypto = require("crypto");
EventEmitter = require("events");
timers = require("timers");
const EMIT_DATA = "data", EMIT_ERROR = "error";

/**
 * Class for DDQ.
 */
class Ddq {
    /**
     * TODO: Validate the config
     *
     * @param {Object} config
     * @throws {Error} when a config is not found
     */
    constructor(config) {
        if (!config) {
            throw new Error("No Config was passed.");
        }

        // Require the backend
        this.backend = require(`ddq-backend-${config.backend}`)();
        this.config = config;
        this.heartbeat = null;
        this.heartbeatRate = config.heartbeatRate;
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
     * Kills the listeners and polling.
     *
     * @param {Function} callback
     */
    close(callback) {
        var error;

        error = null;
        this.listener.removeListener(EMIT_DATA, this.listener);
        this.listener.removeListener(EMIT_ERROR, this.listener);
        timers.clearInterval(this.polling);
        this.polling = null;

        callback(error);
    }


    /**
     * Once the message is done we can call the storage to do what it needs to.
     */
    finishMessage() {
        timers.clearInterval(this.heartbeat);
        this.heartbeat = null;
    }


    /**
     * Gets data from the wrapped message from the backend storage.
     *
     * @return {Object}
     */
    getWrappedMessage() {
        return this.backend.getWrappedMessage();
    }


    /**
     * Grabs a message and sets the owner and heartbeat date.
     *
     * @return {Object}
     */
    grabMessage() {
        var data;

        this.pausePolling();
        data = this.getWrappedMessage();

        return this.backend.grabMessage(data.id);
    }


    /**
     * Starts the polling and emits when data changes or an error happens.
     *
     * @return {EventEmitter}
     */
    listen() {
        this.listener = new EventEmitter();
        this.listener.addListener(EMIT_DATA);
        this.listener.addListener(EMIT_ERROR);
        this.startPolling();

        return this.listener;
    }


    /**
     * Pauses the polling for until started up again. This
     * can be used if the consumer needs to take care of something
     * and doesn't want events to be emiited for a time.
     */
    pausePolling() {
        timers.clearInterval(this.polling);
        this.polling = null;
    }


    /**
     * Sends the message to the backend. This will require a callback to do
     * functionality once the message is sent.
     *
     * @param {*} message
     * @param {Function} callback
     * @throws {Error} when no message is passed or a problem sending
     */
    sendMessage(message, callback) {
        var error, finalObject;

        error = null;

        if (!message) {
            throw new Error("No Message passed.");
        }

        try {
            finalObject = {
                id: crypto.createHash("sha256").update(message).digest("hex"),
                message: message.toString("base64")
            };
        } catch (err) {
            error = new Error("cound not create data to send.");
        }

        if (!error && !this.backend.sendMessage(finalObject)) {
            error = new Error("Problem with sending message to storage");
        }

        callback(error);
    }


    /**
     * Starts the heartbeat for a particular message id.
     *
     * @param {string} messageId
     */
    startHeartbeat(messageId) {
        var heartbeatData;

        heartbeatData = {
            id: messageId,
            owner: this.config.hostname
        };
        this.heartbeat = timers.setInterval(() => {
            if (!this.backend.setHeartbeat(heartbeatData)) {
                this.listener.emit("error");
            }
        }, this.heartbeatRate);
    }


    /**
     * Starts polling to see if there is data. When data is found we emit
     * the "data" event.
     */
    startPolling() {
        this.polling = timers.setInterval(() => {
            if (this.checkForData()) {
                this.listener.emit(EMIT_DATA);

                return;
            }
        }, this.pollingRate);
    }
}

module.exports = Ddq;
