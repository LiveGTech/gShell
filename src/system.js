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

exports.executeCommand = function(command, args = []) {
    return new Promise(function(resolve, reject) {
        child_process.execFile(command, args, function(error, stdout, stderr) {
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

    return exports.executeCommand("sudo", ["shutdown", "-h", "now"]);
};

exports.sleep = function() {
    if (!flags.isRealHardware) {
        return Promise.resolve();
    }

    return exports.executeCommand("sudo", ["systemctl", "suspend"]);
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
            }[fs.readFileSync("/sys/class/power_supply/axp20x-battery/status", "utf8").split("\n")[0]] || null,
            level: parseInt(fs.readFileSync("/sys/class/power_supply/axp20x-battery/capacity", "utf8").split("\n")[0])
        });
    } catch (e) {
        return Promise.reject(e);
    }
};

exports.setColourScheme = function(scheme = "light") {
    if (!["light", "dark"].includes(scheme)) {
        return Promise.reject("Invalid colour scheme");
    }

    electron.nativeTheme.themeSource = scheme;

    return Promise.resolve();
};

exports.devRestart = function() {
    if(!flags.isRealHardware) {
        electron.app.relaunch();
    }

    electron.app.exit();

    return Promise.resolve();
};