/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const child_process = require("child_process");
const electron = require("electron");

var flags = require("./flags");

exports.executeCommand = function(command) {
    return new Promise(function(resolve, reject) {
        child_process.exec(command, function(error, stdout, stderr) {
            if (error) {
                reject({stdout, stderr});

                return;
            }

            resolve({stdout, stderr});
        });
    });
};

exports.getScreenResolution = function() {
    if (!flags.isRealHardware()) {
        return Promise.resolve({width: 360, height: 720});
    }

    return exports.executeCommand("xdpyinfo").then(function(output) {
        var matches = output.stdout.match(/^\s*dimensions:\s+([0-9]+)x([0-9]+) pixels/m);

        return Promise.resolve({width: Number(matches[1]), height: Number(matches[2])});
    });
};

exports.shutDown = function() {
    if (!flags.isRealHardware()) {
        electron.app.exit(0);

        return Promise.resolve();
    }

    return exports.executeCommand("sudo shutdown -h now");
};