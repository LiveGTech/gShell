/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var main = require("./main");
var flags = require("./flags");
var system = require("./system");

var signalPollIntervals = {};

function getCommandJson() {
    return system.executeCommand(...arguments).then(function(output) {
        try {
            return Promise.resolve(JSON.parse(output.stdout));
        } catch (e) {
            return Promise.reject(e);
        }
    });
}

function remapValue(value, aMin, aMax, bMin, bMax) {
    return bMin + ((bMax - bMin) * ((value - aMin) / (aMax - aMin)));
}

function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

exports.listModems = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve({
            "/org/freedesktop/ModemManager1/Modem/0": {
                name: "gShell Dummy Modem",
                manufacturer: "LiveG Technologies",
                powered: true,
                enabled: true
            }
        });
    }

    return getCommandJson("mmcli", ["--output-json", "--list-modems"]).then(function(modemListData) {
        var promiseChain = Promise.resolve();
        var modems = {};

        modemListData["modem-list"].forEach(function(modemId) {
            promiseChain = promiseChain.then(function() {
                return getCommandJson("mmcli", ["--output-json", "--modem", modemId]).then(function(modemData) {
                    modems[modemId] = {
                        name: modemData["modem"]["generic"]["model"],
                        manufacturer: modemData["modem"]["generic"]["manufacturer"],
                        powered: modemData["modem"]["generic"]["power-state"] == "on",
                        enabled: modemData["modem"]["generic"]["state"] != "disabled"
                    };

                    return Promise.resolve();
                });
            });
        });

        return promiseChain.then(function() {
            return Promise.resolve(modems);
        });
    });
};

exports.setModemPowerState = function(modemId, enable = true) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    if (!enable) {
        delete signalPollIntervals[modemId];
    }

    return system.executeCommand("mmcli", ["--modem", modemId, enable ? "--enable" : "--disable"]);
};

exports.getSignalInfo = function(modemId) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve({
            bestAvailableTechnology: "lte",
            technologies: {
                gsm: null,
                cdma1x: null,
                evdo: null,
                umts: null,
                lte: {
                    rssi: -78,
                    rsrp: -113,
                    rsrq: -13,
                    snr: 2.6,
                    strength: 60
                }
            }
        });
    }

    return getCommandJson("mmcli", ["--output-json", "--modem", modemId, "--signal-get"]).then(function(modemSignalInfo) {
        var result = {
            bestAvailableTechnology: null,
            technologies: {}
        };

        ["gsm", "cdma1x", "evdo", "umts", "lte", "5g"].forEach(function(technology) {
            var technologyInfo = modemSignalInfo["modem"]["signal"][technology] || {};
            var anyStrengthAvailable = false;

            function extractStrengthValue(stringValue) {
                if (stringValue == "--") {
                    return undefined;
                }

                anyStrengthAvailable = true;
    
                return parseFloat(stringValue);
            }

            result.technologies[technology] = {
                rssi: extractStrengthValue(technologyInfo["rssi"]),
                rsrp: extractStrengthValue(technologyInfo["rsrp"]),
                rsrq: extractStrengthValue(technologyInfo["rsrq"]),
                rscp: extractStrengthValue(technologyInfo["rscp"]),
                ecio: extractStrengthValue(technologyInfo["ecio"]),
                snr: extractStrengthValue(technologyInfo["snr"]),
                sinr: extractStrengthValue(technologyInfo["sinr"]),
            };

            if (technologyInfo["rsrq"]) {
                result.technologies[technology].strength = clampValue(remapValue(extractStrengthValue(technologyInfo["rsrq"]), -25, -5, 0, 100), 0, 100);
            } else if (technologyInfo["sinr"]) {
                result.technologies[technology].strength = clampValue(remapValue(extractStrengthValue(technologyInfo["sinr"]), -3, 23, 0, 100), 0, 100);
            } else if (technologyInfo["rsrp"]) {
                result.technologies[technology].strength = clampValue(remapValue(extractStrengthValue(technologyInfo["rsrp"]), -110, -70, 0, 100), 0, 100);
            }

            if (!anyStrengthAvailable) {
                result.technologies[technology] = null;

                return;
            }

            result.bestAvailableTechnology = technology;
        });
    });
};

exports.setSignalPollInterval = function(modemId, interval) {
    clearInterval(signalPollIntervals[modemId]);

    function applyInterval() {
        signalPollIntervals[modemId] = setInterval(function() {
            exports.getSignalInfo(modemId).then(function(data) {
                main.window.webContents.send("mobile_signalUpdate", {modemId, data});
            }).catch(function(error) {
                clearInterval(signalPollIntervals[modemId]);

                return Promise.reject(error);
            });
        }, interval);
    }

    if (!flags.isRealHardware && !flags.allowHostControl) {
        applyInterval();

        return Promise.resolve();
    }

    return system.executeCommand("mmcli", ["--modem", modemId, "--signal-setup", String(Math.floor(interval / 1_000))]).then(function() {
        applyInterval();
    });
};