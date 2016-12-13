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
     * Calls the backend to stop listening and sets the isListening flag.
     *
     * @param {DDQ~Instance} ddqInstance
     */
    function listenStop(ddqInstance) {
        ddqInstance.backend.stopListening(() => {
            finishClosing(ddqInstance);
        });
        ddqInstance.isListening = false;
    }


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
            this.connection = false;
            this.isListening = false;
            this.isPausedByLimits = false;
            this.maxProcessingMessages = config.maxProcessingMessages;
        }


        /**
         * Calls the backend plugin to begin listening and sets up listeners for
         * both data and error events.
         *
         * @param {Function} [callback]
         */
        listenStart(callback) {
            if (!callback) {
                callback = noop;
            }

            console.log("listenStart called");
            if (!this.busy && this.connection && !this.isListening) {
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
                            this.emit(EMIT_ERROR, new Error("Message completion callback was called multiple times."));
                        }

                        doneWasCalled = true;
                        timeoutRemover();

                        if (err) {
                            wrappedMessage.requeue(callback);
                        } else {
                            wrappedMessage.remove(callback);
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
                callback(new Error("Could not start listening."));
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

            console.log("Close called");
            if (!this.busy && this.connection) {
                this.busy = true;

                this.closeCallback = () => {
                    this.backend.disconnect(callback);
                    this.busy = false;
                    this.connection = false;
                };

                if (this.messagesInTransit === 0) {
                    if (this.isListening) {
                        listenStop(this);
                    } else {
                        finishClosing(this);
                    }
                } else {
                    this.busy = false;
                    this.close(callback);
                }
            } else {
                callback();
            }
        }


        /**
         * Opens a connection to the database.
         *
         * @param {Function} [callback]
         */
        open(callback) {
            console.log("Open called");

            if (!callback) {
                callback = noop;
            }

            if (!this.busy && !this.connection) {
                this.busy = true;

                this.backend.connect((err) => {
                    this.busy = false;
                    this.connection = true;
                    callback(err);
                });
            } else {
                callback(new Error("Could not open."));
            }
        }


        /**
         * Sends the message to the backend.
         *
         * @param {Function} [callback]
         * @param {*} message
         * @param {string} [topic]
         */
        sendMessage(callback, message, topic) {
            var args;

            console.log("SendMessage called");
            args = this.validateArgs(callback, message, topic);

            if (!this.busy && this.connection) {
                this.messagesInTransit += 1;

                // Topic must be a non-empty string.
                if (typeof args[2] !== "string" || !args[2].length) {
                    topic = null;
                }

                console.log(args);
                this.backend.sendMessage.apply(this.backend, args);
            } else {
                args[0](new Error("Could not send message."));
            }
        }


        /**
         * Checks that a callback was passed as the first argument. If it
         * wasn't, it sets the first argument to a noop function.
         *
         * @return {Array} args
         */
        validateArgs() {
            var args;

            args = [].slice.call(arguments);

            if (typeof args[0] !== "function") {
                args.unshift(noop);
            }

            return args;
        }
    }

    return Ddq;
};
