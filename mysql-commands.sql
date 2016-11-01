DROP DATABASE IF EXISTS testQueue;
CREATE DATABASE testQueue;
USE testQueue;
CREATE TABLE queue (
    hash CHAR(64),
    PRIMARY KEY(hash),
    message VARCHAR(120) NOT NULL,
    requeued BOOLEAN DEFAULT FALSE,
    heartbeatDate DATETIME,
    owner VARCHAR(256),
    isProcessing BOOLEAN DEFAULT FALSE,
    INDEX isProcessing(isProcessing),
    topic VARCHAR(256)
);
