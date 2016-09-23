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
 * @property {Instance} backend
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
 * Subtracts one from the number of messages being processed and checks if
 * resumePolling should be called.
 *
 * @param {Ddq~DdqInstance} ddqInstance
 */
function decrementProcessingMessagesAndResumePolling(ddqInstance) {
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
 * @param {Ddq~DdqInstance} ddqInstance
 * @param {Ddq~wrappedMessage} wrappedMessage
 * @param {Object} timers
 * @return {Function}
 */
function doTheHeartbeat(ddqInstance, wrappedMessage, timers) {
    var timeoutHandle;

    /**
     * Handles the heartbeat of the process sending information needed for
     * the backend to complete it's task.
     */
    function heartbeat() {
        wrappedMessage.heartbeat((err) => {
            if (err) {
                ddqInstance.emit(EMIT_ERROR, err);
            }

            timeoutHandle = timers.setTimeout(heartbeat, ddqInstance.heartbeatDelay);
        });
    }

    timeoutHandle = timers.setTimeout(heartbeat, ddqInstance.heartbeatDelay);

    return () => {
        timers.clearTimeout(timeoutHandle);
    };
}


/**
 * Adds one to the messages being processed property and checks if polling
 * should be paused.
 *
 * @param {Ddq~DdqInstance} ddqInstance
 */
function incrementProcessingMessagesAndPausePolling(ddqInstance) {
    ddqInstance.messagesBeingProcessed += 1;

    if (ddqInstance.messagesBeingProcessed >= ddqInstance.config.maxProcessingMessages) {
        ddqInstance.isPausedByLimits = true;
        ddqInstance.backend.pausePolling();
    }
}


/**
 * Don't want to take any action here.
 */
function noop() {}

module.exports = (EventEmitter, timers) => {
    /**
     * Class for DDQ.
     */
    class Ddq extends EventEmitter {
        /**
         * @param {Ddq~config} config
         * @throws {Error} when a config is not found
         */
        constructor(config) {
            if (!config) {
                throw new Error("No config was passed.");
            }

            super();
            this.backend = require(`ddq-backend-${config.backend}`)(config.backendConfig);
            this.config = config;
            this.heartbeatDelay = config.heartbeatDelay;
            this.isPausedByLimits = false;
            this.isPausedByUser = false;
            this.messagesBeingProcessed = 0;
            this.pollingPaused = false;
        }


        /**
         * Kills the listeners and polling.
         *
         * @param {Function} [callback]
         */
        close(callback) {
            if (!callback) {
                callback = noop;
            }

            this.backend.close(callback);
        }


        /**
         * When the instance is destroyed, we want to close connections the
         * instance has made, so the connections do not keep running.
         */
        destroy() {
            this.close((err) => {
                if (err) {
                    this.emit(EMIT_ERROR, new Error("Could not close connection."));
                }
            });
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

                if (this.isPausedByUser) {
                    wrappedMessage.requeue();
                } else {
                    doneWasCalled = false;
                    timeoutRemover = doTheHeartbeat(this, wrappedMessage, timers);
                    incrementProcessingMessagesAndPausePolling(this);
                    this.emit(EMIT_DATA, wrappedMessage.message, (err) => {
                        if (doneWasCalled) {
                            this.emit(EMIT_ERROR, new Error("Message completion callback was called multiple times"));
                        }

                        doneWasCalled = true;
                        timeoutRemover();
                        decrementProcessingMessagesAndResumePolling(this);
                        wrappedMessage.heartbeatKill();

                        if (err) {
                            wrappedMessage.requeue();
                        } else {
                            wrappedMessage.remove();
                        }
                    });
                }
            });


            /* Just want to send the error event to the caller. The caller
             * should decide what to do next.
             */
            this.backend.on(EMIT_ERROR, (err) => {
                this.emit(EMIT_ERROR, err);
            });
        }


        /**
         * Tells the backend to pause the polling. This can be used if
         * the consumer needs to take care of something and does not want
         * the polling to continue.
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
         * Sends the message to the backend.
         *
         * @param {*} message
         * @param {Function} [callback]
         */
        sendMessage(message, callback) {
            if (!callback) {
                callback = noop;
            }

            this.backend.sendMessage(message, callback);
        }
    }

    return Ddq;
};
