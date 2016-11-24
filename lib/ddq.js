"use strict";


/**
 * @typeDef {Object} Ddq~config
 * @property {string} backend
 * @property {Object} backendConfig
 * @property {string} heartbeatDelay
 * @property {string} hostname
 * @property {number} maxProcessingMessages
 */


/**
 * @typeDef {Object} Ddq~DdqInstance
 * @property {Instance} backend
 * @property {Object} config
 * @property {interger} heartbeatDelay
 * @property {boolean} isPausedByLimits
 * @proprety {number} messagesBeingProcessed
 */


/**
 * What DDQ gets back from the backend to process for the consumer to get
 * and for what happens when the consumer has finished processing.
 *
 * @typeDef {Object} Ddq~wrappedMessage
 * @property {Function} heartbeat
 * @property {string} message
 * @property {Function} remove
 * @property {Function} requeue
 * @property {string} topic
 */

const EMIT_DATA = "data";
const EMIT_ERROR = "error";

module.exports = (configValidation, EventEmitter, timers) => {
    /**
     * Signals that a message is done being processed.
     *
     * When we were at our limit of simultaneous messages being processed,
     * this will start the backend up and let it poll again for more messages.
     *
     * @param {Ddq~DdqInstance} ddqInstance
     */
    function messageCompleted(ddqInstance) {
        ddqInstance.messagesBeingProcessed -= 1;

        if (ddqInstance.isPausedByLimits) {
            if (ddqInstance.messagesBeingProcessed < ddqInstance.maxProcessingMessages) {
                ddqInstance.isPausedByLimits = false;

                ddqInstance.resumeListening();
            }
        }
    }


    /**
     * Starts a loop to repeatedly call a message's heartbeat function.
     * Returns a function that will clear the heartbeat.
     *
     * @param {Ddq~DdqInstance} ddqInstance
     * @param {Ddq~wrappedMessage} wrappedMessage
     * @param {Object} timers
     * @return {Function}
     */
    function doTheHeartbeat(ddqInstance, wrappedMessage) {
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
     * Updates counters to indicate another message is being processed.
     * If we are at our limit, this pauses the backend's polling for more
     * messages.
     *
     * @param {Ddq~DdqInstance} ddqInstance
     */
    function messageBeingProcessed(ddqInstance) {
        ddqInstance.messagesBeingProcessed += 1;

        if (ddqInstance.messagesBeingProcessed >= ddqInstance.maxProcessingMessages) {
            ddqInstance.isPausedByLimits = true;
            ddqInstance.backend.stopListening();
        }
    }


    /**
     * Don't want to take any action here.
     */
    function noop() {}


    /**
     * Class for DDQ.
     */
    class Ddq extends EventEmitter {
        /**
         * @param {Ddq~config} config
         * @throws {Error} when a config is not found
         */
        constructor(config) {
            var Plugin;

            Plugin = require(`ddq-backend-${config.backend}`);

            configValidation.validateConfig(config);
            super();
            this.backend = new Plugin(config.backendConfig);
            this.heartbeatDelay = config.heartbeatDelayMs;
            this.isListening = false;
            this.isPausedByLimits = false;
            this.maxProcessingMessages = config.maxProcessingMessages;
            this.messagesBeingProcessed = 0;
        }


        /**
         * Checks whether the plugin is connected to the database. If it
         * isn't, it will attempt to connect.
         *
         * @param {Function} [errorCallback]
         * @param {Function} [successCallback]
         */
        connect(errorCallback, successCallback) {
            if (!errorCallback) {
                errorCallback = noop;
            }

            if (!successCallback) {
                successCallback = noop;
            }

            if (this.backend.connection) {
                successCallback();
            } else {
                this.backend.connect((err) => {
                    if (err) {
                        errorCallback(err);
                    } else {
                        successCallback();
                    }
                });
            }
        }


        /**
         * Stops listening and disconnects.
         *
         * @param {Function} [callback]
         */
        close(callback) {
            if (!callback) {
                callback = noop;
            }

            this.isListening = false;
            this.backend.stopListening(() => {
                this.backend.disconnect(callback);
            });
        }


        /**
         * Starts the polling and emits when data changes or an error happens.
         *
         * @param {Function} callback
         * @param {Function} [connectionCallback]
         */
        open(callback, connectionCallback) {
            this.connect(connectionCallback, () => {
                this.backend.startListening(callback);
                this.isListening = true;

                /* The backend will emit a data event with a wrapped message. We
                 * unwrap the message, construct convenience functions and send
                 * that to whatever is listening to these messages from us.
                 */
                this.backend.on(EMIT_DATA, (wrappedMessage) => {
                    var doneWasCalled, timeoutRemover;

                    doneWasCalled = false;
                    timeoutRemover = doTheHeartbeat(this, wrappedMessage);
                    messageBeingProcessed(this);
                    this.emit(EMIT_DATA, wrappedMessage.message, (err) => {
                        if (doneWasCalled) {
                            this.emit(EMIT_ERROR, new Error("Message completion callback was called multiple times"));
                        }

                        doneWasCalled = true;
                        timeoutRemover();
                        messageCompleted(this);

                        if (err) {
                            wrappedMessage.requeue();
                        } else {
                            wrappedMessage.remove();
                        }
                    });
                });


                /**
                 * Just want to relay the error event to the another listener.
                 * The listener should then decide what to do next.
                 */
                this.backend.on(EMIT_ERROR, (err) => {
                    this.emit(EMIT_ERROR, err);
                });
            });
        }


        /**
         * Resumes listening if a user has not paused the polling, DDQ has not
         * reached its limit of simultaneous messages being processed and DDQ is
         * listening for events.
         *
         * @param {Function} callback
         * @param {Function} [connectionCallback]
         */
        resumeListening(callback, connectionCallback) {
            this.connect(connectionCallback, () => {
                if (!this.isPausedByLimits && this.isListening) {
                    this.backend.startListening(callback);
                }
            });
        }


        /**
         * Sends the message to the backend.
         *
         * @param {*} message
         * @param {Function} [callback]
         * @param {Function} [errorCallback]
         * @param {string} [topic]
         */
        sendMessage(message, callback, errorCallback, topic) {
            this.connect(errorCallback, () => {
                if (!callback) {
                    callback = noop;
                }

                this.backend.sendMessage(message, callback, topic);
            });
        }
    }

    return Ddq;
};
