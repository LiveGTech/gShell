/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const pty = require("node-pty");

var main = require("./main");
var flags = require("./flags");
var storage = require("./storage");

const DATA_READ_BATCH_THRESHOLD = 10;
const DATA_READ_WINDOW = 1_000 / 24; // 24 FPS

exports.allProcesses = [];

exports.spawn = function(file = "bash", readCallback = function(data) {}, exitCallback = function(exitCode, signal) {}, args = [], options = {}) {
    options.cwd ||= storage.storageFilesystemLocation;

    options.env = {
        ...process.env,
        "LD_PRELOAD": `${main.rootDirectory}/src/clib/libgslai.so`,
        ...(options.env || {})
    };

    if (!flags.isRealHardware && !flags.allowHostControl) {
        exports.allProcesses.push({readCallback, exitCallback});

        return Promise.resolve(exports.allProcesses.length - 1);
    }

    var ptyInstance = pty.spawn(file, args, options);
    var receivedInWindow = 0;
    var batchedInLastWindow = false;
    var buffer = [];

    ptyInstance.onData(function(data) {
        receivedInWindow++;

        if (receivedInWindow < DATA_READ_BATCH_THRESHOLD && !batchedInLastWindow) {
            readCallback(data);

            return;
        }

        buffer.push(data);
    });

    var bufferWindowInterval = setInterval(function() {
        if (buffer.length == 0) {
            batchedInLastWindow = false;

            return;
        }

        readCallback(buffer.join(""));

        receivedInWindow = 0;
        batchedInLastWindow = true;
        buffer = [];
    }, DATA_READ_WINDOW);

    ptyInstance.onExit(function(event) {
        exitCallback(event.exitCode, event.signal);
    });

    exports.allProcesses.push({pty: ptyInstance, readCallback, exitCallback, bufferWindowInterval});

    return Promise.resolve(exports.allProcesses.length - 1);
};

exports.kill = function(id, signal = 9) {
    if (id >= exports.allProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    if (exports.allProcesses[id] == null) {
        return Promise.resolve();
    }

    if (!flags.isRealHardware && !flags.allowHostControl) {
        exports.allProcesses[id].exitCallback();

        return Promise.resolve();
    }

    clearTimeout(exports.allProcesses[id].bufferWindowInterval);

    exports.allProcesses[id].pty.kill(signal);

    return Promise.resolve();
};

exports.write = function(id, data) {
    if (id >= exports.allProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    if (exports.allProcesses[id] == null) {
        return Promise.reject("Process has since been killed");
    }

    if (!flags.isRealHardware && !flags.allowHostControl) {
        exports.allProcesses[id].readCallback(data); // Echo written text as a test

        return Promise.resolve();
    }

    exports.allProcesses[id].pty.write(data);
};

exports.setSize = function(id, columns, rows) {
    if (id >= exports.allProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    if (exports.allProcesses[id] == null) {
        return Promise.reject("Process has since been killed");
    }

    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    exports.allProcesses[id].pty.resize(columns, rows);

    return Promise.resolve();
};