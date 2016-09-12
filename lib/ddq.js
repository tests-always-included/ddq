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
        this.backend = require(`ddq-backend-${config.backend}`)(config.backendConfig);
        this.config = config;
        this.heartbeats = {};
        this.heartbeatRate = config.heartbeatRate;
        this.listener = null;
        this.backendListener = null;
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
        callback(error);
    }


    /**
     * Once the message is done we can call the storage to do what it needs to.
     */
    messageSuccess(messageId) {
        this.heartbeats[messageId].obj.success();
        timers.clearInterval(this.heartbeats[messageId].timer);
        delete this.heartbeats.messageId;
    }

    /**
     * If the message fails we want to call to requeue.
     */
    messageFailure(messageId) {
        this.heartbeats[messageId].obj.failure();
        timers.clearInterval(this.heartbeats[messageId].timer);
        delete this.heartbeats.messageId;
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
        this.backendListener = this.backend.listen();
        this.backendListener.on(EMIT_DATA, (data) => {
            this.listener.emit(EMIT_DATA, data);
        });
        this.backendListener.on(EMIT_ERROR, (error) => {


        });

        return this.listener;
    }


    /**
     * Pauses the polling for until started up again. This
     * can be used if the consumer needs to take care of something
     * and doesn't want events to be emiited for a time.
     */
    pausePolling() {
        this.backend.pausePolling();
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
        var error, finalObject, msgBuffer;

        error = null;

        if (!message) {
            throw new Error("No Message passed.");
        }

        msgBuffer = new Buffer(message, "binary");

        try {
            finalObject = {
                id: crypto.createHash("sha256").update(msgBuffer).digest("hex"),
                message: msgBuffer.toString("base64")
            };
        } catch (err) {
            error = new Error("Could not create data to send.");
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
    startHeartbeat() {
        var data, heartbeatData;

        data = this.backend.getWrappedMessage();

        heartbeatData = {
            id: data.data.id,
            owner: this.config.hostname
        };

        if (!this.heartbeats[data.data.id]) {
            this.heartbeats[data.data.id] = {
                timer: null,
                obj: data
            };

            this.heartbeats[data.data.id].timer = timers.setInterval(() => {
                if (!this.backend.setHeartbeat(heartbeatData)) {
                    this.listener.emit(EMIT_ERROR);
                }
            }, this.heartbeatRate);
        }
    }
}

module.exports = Ddq;
