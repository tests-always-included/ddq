"use strict";

/**
 * @typeDef {Object} Ddq~config
 * @property {string} backend
 * @property {Ddq~backendConfig} backendConfig
 * @property {string} heartbeatDelay
 * @property {string} hostname
 * @property {number} maxProcessingMessages
 */

/**
 * @typeDef {Object} Ddq~backendConfig
 * @property {string} host
 * @property {string} password
 * @property {string} [port]
 */

/**
 * @typeDef {Object} Ddq~DdqInstance
 * @property {} backend
 * @property {Object} config
 * @property {interger} heartbeatDelay
 * @property {boolean} isPausedByLimits
 * @property {boolean} isPausedByUser
 * @proprety {interger} messagesBeingProcessed
 */

/**
 * What DDQ gets back from the backend to process for the consumer to get
 * and for what happens when the consumer has finished processing.
 *
 * @typeDef {Object} Ddq~wrappedMessage
 * @property {string} message
 * @property {Function} remove
 * @property {Function} requeue
 */

const EMIT_DATA = "data", EMIT_ERROR = "error";

/**
 * Sets the messages being processed number back one number and checks to see
 * if the polling should be resumed if the limit is less then the max and it
 * the polling hasn't been manually paused by the user.
 *
 * @param {Ddq~DdqInstance}
 */
function decrementMessagesBeingProcessed(ddqInstance) {
    ddqInstance.messagesBeingProcessed -= 1;
    if (ddqInstance.isPausedByLimits) {
        if (ddqInstance.messagesBeingProcessed < ddqInstance.config.maxProcessingMessages) {
            ddqInstance.isPausedByLimits = false;

            if (!ddqInstance.isPausedByUser) {
                ddqInstance.resumePolling();
            }
        }
    }
}


/**
 * Sets up and clears the heartbeat for a particular message.
 *
 * @param {Ddq~DdqInstance}
 * @param {Ddq~wrappedMessage}
 * @param {Object} timers
 */
function doTheHeartbeat(ddqInstance, wrappedMessage, timers) {
    var timeoutHandle;

    function heartbeat() {
        wrappedMessage.heartbeat(wrappedMessage.original.id, ddqInstance.config.hostname, (err) => {
            if (err) {
                ddqInstance.emit(EMIT_ERROR, err);
            }

            timeoutHandle = timers.setTimeout(heartbeat, ddqInstance.config.heartbeatDelay);
        });
    }

    timeoutHandle = timers.setTimeout(heartbeat, ddqInstance.config.heartbeatDelay);

    return () => {
        timers.clearTimeout(timeoutHandle);
    };
}


/**
 * Sets the messages being processed up one and pauses the polling for the
 * backend. Also sets the flag for paused by limits. This is so DDQ knows the
 * reason for the pausing was because it shouldn't be processing anymore then
 * what the consumer wants to handle.
 *
 * @param {Ddq~DdqInstance} ddqInstance
 */
function incrementMessagesBeingProcessed(ddqInstance) {
    ddqInstance.messagesBeingProcessed += 1;

    if (ddqInstance.messagesBeingProcessed >= ddqInstance.config.maxMessagesBeingProcessed) {
        ddqInstance.isPausedByLimits = true;
        ddqInstance.backend.pausePolling();
    }
}

module.exports = (EventEmitter, timers) => {
    /**
     * Class for DDQ.
     */
    class Ddq extends EventEmitter {
        /**
         * TODO: Validate the config
         *
         * @param {Ddq~config} config
         * @throws {Error} when a config is not found
         */
        constructor(config) {
            if (!config) {
                throw new Error("No Config was passed.");
            }

            super();
            this.backend = require(`ddq-backend-${config.backend}`)(config.backendConfig);
            this.config = config;
            this.messagesBeingProcessed = 0;
            this.heartbeatDelay = config.heartbeatDelay;
            this.isPausedByUser = false;
            this.isPausedByLimits = false;
        }


        /**
         * When the instance is destroyed we want to close connections the
         * instance has made so we don't have connections to keep running.
         */
        destroy() {
            this.close((err) => {
                if (err) {
                    this.emit(EMIT_ERROR, new Error("Could not close connection."));
                }
            });
        }


        /**
         * Kills the listeners and polling.
         *
         * @param {Function} callback
         */
        close(callback) {
            this.backend.close(callback);
        }


        /**
         * Starts the polling and emits when data changes or an error happens.
         */
        listen() {
            this.backend.listen();


            /* The backend will emit a data event with a wrapped message.
             * We unwrap the message, construct convenience functions and
             * send that to whatever is listening to these messages from us.
             */
            this.backend.on(EMIT_DATA, (wrappedMessage) => {
                var doneWasCalled, timeoutRemover;

                doneWasCalled = false;
                timeoutRemover = doTheHeartbeat(this, wrappedMessage, timers);
                incrementMessagesBeingProcessed(this);

                this.emit(EMIT_DATA, wrappedMessage.message, (err) => {
                    if (doneWasCalled) {
                        return this.emit(EMIT_ERROR, new Error("Message completion callback was called multiple times"));
                    }

                    doneWasCalled = true;
                    timeoutRemover();
                    decrementMessagesBeingProcessed(this);

                    if (err) {
                        wrappedMessage.requeue(wrappedMessage.original.id);
                    } else {
                        wrappedMessage.remove(wrappedMessage.original.id);
                    }

                    return true;
                });
            });


            /* Just want to send the error event to the caller. The caller
             * should decide what to do next.
             */
            this.backend.on(EMIT_ERROR, (err) => {
                this.emit(EMIT_ERROR, err);
            });
        }


        /**
         * Pauses the polling for until started up again. This
         * can be used if the consumer needs to take care of something
         * and doesn't want events to be emiited for a time.
         */
        pausePolling() {
            this.isPausedByUser = true;
            this.backend.pausePolling();
        }


        /**
         * Resumes polling if conditions agree.
         */
        resumePolling() {
            if (this.isPausedByUser) {
                this.isPausedByUser = false;

                if (!this.isPausedByLimits) {
                    this.backend.resumePolling();
                }
            }
        }


        /**
         * Sends the message to the backend. This will require a callback to do
         * functionality once the message is sent.
         *
         * @param {*} message
         * @param {Function} callback
         */
        sendMessage(message, callback) {
            this.backend.sendMessage(message, callback);
        }
    }

    return Ddq;
};
