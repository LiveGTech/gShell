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

// TODO: We ideally need to abstract the information retrieved from mmcli into a more generic format

function getCommandJson() {
    return system.executeCommand(...arguments).then(function(output) {
        try {
            return Promise.resolve(JSON.parse(output.stdout));
        } catch (e) {
            return Promise.reject(e);
        }
    });
}

exports.listModems = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve({
            "/org/freedesktop/ModemManager1/Modem/0": {
                "generic": {
                    "access-technologies": ["lte"],
                    "manufacturer": "LiveG Technologies",
                    "model": "gShell Dummy Modem",
                    "power-state": "on",
                    "state": "registered"
                }
            }
        });
    }

    return getCommandJson("mmcli", ["--output-json", "--list-modems"]).then(function(modemListData) {
        var promiseChain = Promise.resolve();
        var modems = {};

        modemListData["modem-list"].forEach(function(modemId) {
            promiseChain = promiseChain.then(function() {
                return getCommandJson("mmcli", ["--output-json", "--modem", modemId]).then(function(modemData) {
                    modems[modemId] = modemData["modem"];

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
            "modem": {
                "signal": {
                    "gsm": {
                        "rssi": "--"
                    },
                    "lte": {
                        "rsrp": "-113.00",
                        "rsrq": "-13.00",
                        "rssi": "-78.00",
                        "snr": "2.60"
                    }
                }
            }
        });
    }

    return getCommandJson("mmcli", ["--output-json", "--modem", modemId, "--signal-get"]);
};

exports.setSignalPollInterval = function(modemId, interval) {
    clearInterval(signalPollIntervals[modemId]);

    function applyInterval() {
        signalPollIntervals[modemId] = setInterval(function() {
            exports.getSignalInfo(modemId).then(function(data) {
                main.window.webContents.send("mobile_signalUpdate", {modemId, data});
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