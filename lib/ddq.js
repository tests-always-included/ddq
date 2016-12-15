"use strict";

/**
 * @typeDef {Object} Ddq~config
 * @property {string} backend
 * @property {Object} backendConfig
 * @property {string} heartbeatDelayMs
 * @property {number} maxProcessingMessages
 */


/**
 * @typeDef {Object} Ddq~DdqInstance
 * @property {Instance} backend
 * @property {Object} config
 * @property {integer} heartbeatDelayMs
 * @property {boolean} isBusy
 * @property {boolean} isClosing
 * @property {boolean} isListening
 * @property {boolean} isOpen
 * @property {boolean} isPausedByLimits
 * @property {integer} messagesInTransit
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
     * Ensures that messagesInTransit is properly decremented and calls the
     * function to check whether or not the connection should be closed.
     *
     * @param {DDQ~instance} ddqInstance
     * @param {Function} callback
     * @return {Function} callback
     */
    function applyCloseConditions(ddqInstance, callback) {
        return (err) => {
            ddqInstance.messagesInTransit -= 1;
            callback(err);
            ddqInstance.handleClosing();
        };
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

                timeoutHandle = timers.setTimeout(heartbeat, ddqBackendInstance.heartbeatDelayMs);
            });
        }

        timeoutHandle = timers.setTimeout(heartbeat, ddqBackendInstance.heartbeatDelayMs);

        return () => {
            timers.clearTimeout(timeoutHandle);
        };
    }


    /**
     * Calls and resets the closeCallback if it already exists.
     *
     * @param {Ddq~DdqBackendPluginInstance} ddqBackendInstance
     */
    function finishClosing(ddqBackendInstance) {
        ddqBackendInstance.closeCallback();
        ddqBackendInstance.closeCallback = null;
    }


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
     * Updates counters to indicate another message is being processed.
     * If we are at our limit, this pauses the backend's polling for more
     * messages.
     *
     * @param {Ddq~DdqInstance} ddqInstance
     */
    function messageBeingProcessed(ddqInstance) {
        ddqInstance.messagesInTransit += 1;

        if (ddqInstance.messagesInTransit >= ddqInstance.maxProcessingMessages) {
            ddqInstance.isPausedByLimits = true;
            ddqInstance.backend.stopListening();
        }
    }


    /**
     * Don't want to take any action here.
     */
    function noop() {}


    /**
     * Signals that a message is done being processed.
     *
     * When we were at our limit of simultaneous messages being processed,
     * this will start the backend up and let it poll again for more messages.
     *
     * @param {Ddq~DdqInstance} ddqInstance
     * @param {Function} [callback]
     */
    function messageCompleted(ddqInstance, callback) {
        if (ddqInstance.isPausedByLimits) {
            if (ddqInstance.messagesInTransit < ddqInstance.maxProcessingMessages) {
                ddqInstance.isPausedByLimits = false;

                ddqInstance.listenStart(callback);
            }
        }
    }


    /**
     * Checks that a callback was passed as the first argument. If it
     * wasn't, it sets the first argument to a noop function.
     *
     * @return {Array} args
     */
    function validateArgs() {
        var args;

        args = [].slice.call(arguments);

        if (typeof args[0] !== "function") {
            args.unshift(noop);
        }

        return args;
    }


    /**
     * DDQ class.
     */
    class Ddq extends EventEmitter {
        /**
         * @param {Ddq~config} config
         */
        constructor(config) {
            var Plugin;

            configValidation.validateConfig(config);
            Plugin = require(`ddq-backend-${config.backend}`);
            super();
            this.backend = new Plugin(config.backendConfig);
            this.heartbeatDelayMs = config.heartbeatDelayMs;
            this.isBusy = false;
            this.isClosing = false;
            this.isOpen = false;
            this.isListening = false;
            this.isPausedByLimits = false;
            this.maxProcessingMessages = config.maxProcessingMessages;
            this.messagesInTransit = 0;
        }


        /**
         * Sets up conditions for closing and calls the function to attempt to
         * close.
         *
         * @param {Function} [callback]
         */
        close(callback) {
            if (!callback) {
                callback = noop;
            }

            if (!this.isBusy && this.isOpen) {
                this.isBusy = true;
                this.isClosing = true;
                this.closeCallback = () => {
                    this.backend.disconnect((err) => {
                        this.isBusy = false;
                        this.isOpen = false;
                        callback(err);
                    });
                };
                this.handleClosing();
            } else {
                callback(new Error("Could not close."));
            }
        }


        /**
         * Checks if the conditions for closing are met and initiates closing if they
         * are. This will also cause listening to stop.
         */
        handleClosing() {
            if (this.isClosing && !this.messagesInTransit) {
                if (this.isListening) {
                    listenStop(this);
                } else {
                    finishClosing(this);
                }
                this.isBusy = false;
            }
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

            if (!this.isBusy && this.isOpen && !this.isListening) {
                this.backend.startListening(() => {
                    this.isListening = true;
                    callback();
                });

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
                            wrappedMessage.requeue(applyCloseConditions(this, callback));
                        } else {
                            wrappedMessage.remove(applyCloseConditions(this, callback));
                        }

                        messageCompleted(this, callback);
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
         * Opens a connection to the database.
         *
         * @param {Function} [callback]
         */
        open(callback) {
            if (!callback) {
                callback = noop;
            }

            if (!this.isBusy && !this.isOpen) {
                this.isBusy = true;

                this.backend.connect((err) => {
                    this.isBusy = false;
                    this.isOpen = true;
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

            args = validateArgs(callback, message, topic);

            if (!this.isBusy && this.isOpen) {
                this.messagesInTransit += 1;

                // Ensure that messagesInTransit is decremented.
                args[0] = applyCloseConditions(this, args[0]);

                // Topic must be a non-empty string.
                if (!args[2] || typeof args[2] !== "string" || !args[2].length) {
                    args[2] = null;
                }

                this.backend.sendMessage.apply(this.backend, args);
            } else {
                args[0](new Error("Could not send message."));
            }
        }
    }

    return Ddq;
};
