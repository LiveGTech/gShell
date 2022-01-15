/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const child_process = require("child_process");
const fs = require("fs");
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

exports.getFlags = function() {
    return Promise.resolve(flags);
};

exports.getScreenResolution = function() {
    if (!flags.isRealHardware) {
        return Promise.resolve({width: 360, height: 720});
    }

    return exports.executeCommand("xdpyinfo").then(function(output) {
        var matches = output.stdout.match(/^\s*dimensions:\s+([0-9]+)x([0-9]+) pixels/m);

        return Promise.resolve({width: Number(matches[1]), height: Number(matches[2])});
    });
};

exports.shutDown = function() {
    if (!flags.isRealHardware) {
        electron.app.exit(0);

        return Promise.resolve();
    }

    return exports.executeCommand("sudo shutdown -h now");
};

exports.getPowerState = function() {
    if (!flags.isRealHardware) {
        return Promise.resolve({
            state: null,
            level: 100
        });
    }

    try {
        return Promise.resolve({
            state: {
                "Charging": "charging",
                "Discharging": "discharging",
                "Not charging": "notCharging",
                "Full": "full"
            }[fs.readFileSync("/sys/class/power_supply/cw2015-battery/status").split("\n")[0]] || null,
            level: Number(fs.readFileSync("/sys/class/power_supply/cw2015-battery/capacity"))
        });
    } catch (e) {
        return Promise.reject(e);
    }
};