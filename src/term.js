/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const pty = require("node-pty");

var flags = require("./flags");
var storage = require("./storage");

exports.allProcesses = [];

exports.spawn = function(file = "bash", readCallback = function(data) {}, exitCallback = function(exitCode, signal) {}, args = [], options = {}) {
    options.cwd ||= storage.storageFilesystemLocation;

    if (!flags.isRealHardware && !flags.allowHostControl) {
        exports.allProcesses.push({readCallback, exitCallback});

        return Promise.resolve(exports.allProcesses.length - 1);
    }

    var process = pty.spawn(file, args, options);

    process.onData(function(data) {
        readCallback(data);
    });

    process.onExit(function(event) {
        exitCallback(event.exitCode, event.signal);
    });

    exports.allProcesses.push(process);

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

    exports.allProcesses[id].kill(signal);

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

    exports.allProcesses[id].write(data);
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

    exports.allProcesses[id].resize(columns, rows);

    return Promise.resolve();
};