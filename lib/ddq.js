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
 * @property {boolean} busy
 * @property {Object} config
 * @property {integer} heartbeatDelay
 * @property {boolean} isListening
 * @property {boolean} isPausedByLimits
 * @property {integer} messageInTransit
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
     * Calls and resets the closeCallback if it already exists.
     *
     * @param {Ddq~DdqBackendPluginInstance} ddqBackendInstance
     */
    function finishClosing(ddqBackendInstance) {
        if (ddqBackendInstance.closeCallback) {
            ddqBackendInstance.closeCallback();
            ddqBackendInstance.closeCallback = null;
        }
    }


    /**
     * Signals that a message is done being processed.
     *
     * When we were at our limit of simultaneous messages being processed,
     * this will start the backend up and let it poll again for more messages.
     *
     * @param {Ddq~DdqInstance} ddqInstance
     */
    function messageCompleted(ddqInstance) {
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
     * @param {DdqBackendPlugin~DdqInstance} ddqBackendInstance
     * @param {Ddq~wrappedMessage} wrappedMessage
     * @param {Object} timers
     * @return {Function}
     */
    function doTheHeartbeat(ddqBackendInstance, wrappedMessage) {
        var timeoutHandle;

        /**
         * Handles the heartbeat of the process sending information needed for
         * the backend to complete it's task.
         */
        function heartbeat() {
            wrappedMessage.heartbeat((err) => {
                if (err) {
                    ddqBackendInstance.emit(EMIT_ERROR, err);
                }

                timeoutHandle = timers.setTimeout(heartbeat, ddqBackendInstance.heartbeatDelay);
            });
        }

        timeoutHandle = timers.setTimeout(heartbeat, ddqBackendInstance.heartbeatDelay);

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
        ddqInstance.messagesInTransit += 1;

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
            this.busy = false;
            this.messagesInTransit = 0;
            this.heartbeatDelay = config.heartbeatDelayMs;
            this.isListening = false;
            this.isPausedByLimits = false;
            this.maxProcessingMessages = config.maxProcessingMessages;
        }


        /**
         * Stops listening and disconnects.
         *
         * @param {Function} [callback]
         */
        close(callback) {
            if (!this.busy && this.backend.connection) {
                this.busy = true;

                this.closeCallback = () => {
                    if (!callback) {
                        callback = noop;
                    }

                    this.backend.stopListening(() => {
                        this.backend.disconnect(callback);
                        this.busy = false;
                    });
                };

                while (this.messagesInTransit > 0) {
                    if (this.isListening) {
                        this.backend.stopListening(() => {
                            finishClosing(this);
                        });
                        this.isListening = false;
                    } else {
                        finishClosing(this);
                    }
                }
            } else {
                this.done(this, new Error("Could not close. DeDuplicated Queue is either already busy or the connection is already closed."));
            }
        }


        /**
         * Decrements the counter and passes any error to the done callback.
         *
         * @param {Error} err
         */
        decrementAndDone(err) {
            this.messagesInTransit -= 1;
            this.done(err);
        }


        /**
         * Done handler. Emits errors.
         *
         * @param {Error} err
         */
        done(err) {
            if (err) {
                this.emit(EMIT_ERROR, err);
            }
        }


        /**
         * Calls the backend plugin to begin listening and sets up listeners for
         * both data and error events.
         *
         * @param {Function} callback
         */
        listenStart(callback) {
            if (!this.busy && this.backend.connection && !this.isListening) {
                this.backend.startListening(callback);

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

                        if (err) {
                            wrappedMessage.requeue(this.decrementAndDone);
                        } else {
                            wrappedMessage.remove(this.decrementAndDone);
                        }

                        messageCompleted(this);
                    });
                });


                /**
                 * Just want to relay the error event to the another listener.
                 * The listener should then decide what to do next.
                 */
                this.backend.on(EMIT_ERROR, (err) => {
                    this.emit(EMIT_ERROR, err);
                });
            } else {
                this.done(this, new Error("Could not start listening. DeDuplicated Queue is either busy, does not have an open connection, or is already listening."));
            }
        }


        /**
         * Opens a connection to the database.
         *
         * @param {Function} [callback]
         */
        open(callback) {
            if (!this.busy && !this.backend.connection) {
                this.busy = true;

                this.backend.connect((err) => {
                    this.done(err);
                    this.busy = false;
                    callback();
                });
            } else {
                this.done(this, new Error("Could not open. DeDuplicated Queue is either busy or the connection to the database is already open."));
            }
        }


        /**
         * Resumes listening if a user has not paused the polling, DDQ has not
         * reached its limit of simultaneous messages being processed and DDQ is
         * listening for events.
         *
         * @param {Function} [callback]
         */
        resumeListening(callback) {
            if (!this.busy && this.backend.connection && !this.isListening) {
                this.backend.startListening(callback);
            } else {
                this.done(this, new Error("Could not start listening. DeDuplicated Queue is either busy, does not have an open connection, or is already listening."));
            }
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
            if (!this.busy && this.backend.connection) {
                this.messagesInTransit += 1;
                this.backend.sendMessage(message, this.decrementAndDone, topic);
            } else {
                this.done(this, new Error("Could not send message. DeDuplicated Queue is either busy or the connection to the database is not open."));
            }
        }
    }

    return Ddq;
};
