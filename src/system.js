/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const child_process = require("child_process");
const stream = require("stream");
const fs = require("fs");
const electron = require("electron");
const bcryptjs = require("bcryptjs");

var flags = require("./flags");
var device = require("./device");

var mediaFeatures = {};

exports.executeCommand = function(command, args = [], stdin = null) {
    return new Promise(function(resolve, reject) {
        var child = child_process.execFile(command, args, function(error, stdout, stderr) {
            if (error) {
                reject({stdout, stderr});

                return;
            }

            resolve({stdout, stderr});
        });

        if (stdin != null) {
            var childStream = new stream.Readable();

            childStream.push(stdin);
            childStream.push(null);
            childStream.pipe(child.stdin);
        }
    });
};

exports.executeOrLogCommand = function(command, args = [], stdin = null) {
    if (!flags.isRealHardware) {
        console.log(`Execute command: ${command} ${args.join(" ")}; stdin: ${stdin}`);

        return Promise.resolve({stdin: null, stdout: null});
    }

    return exports.executeCommand(...arguments);
};

exports.getFlags = function() {
    return Promise.resolve(flags);
};

exports.getDevice = function() {
    return Promise.resolve(device.data);
};

exports.isInstallationMedia = function() {
    if (flags.emulateInstallationMedia) {
        return Promise.resolve(true);
    }

    if (!flags.isRealHardware) {
        return Promise.resolve(false);
    }

    return exports.executeCommand("df", ["~"]).then(function(output) {
        var disk = output.stdin.split("\n")[1].split(" ")[0];

        if (disk == "/dev/sr0") {
            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    });
};

exports.parseNmcliLine = function(line) {
    var data = [];
    var field = "";
    var escaping = false;

    for (var i = 0; i < line.length; i++) {
        if (escaping) {
            field += line[i];
            escaping = false;

            continue;
        }

        switch (line[i]) {
            case "\\":
                escaping = true;
                break;

            case ":":
                data.push(field);

                field = "";

                break;

            default:
                field += line[i];
                break;
        }
    }

    data.push(field);

    return data;
};

exports.getScreenResolution = function() {
    if (!flags.isRealHardware) {
        return Promise.resolve({
            "desktop": {width: 1024, height: 768}
        }[device.data?.type] || {width: 360, height: 720});
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
    if (!(
        typeof(device.data?.hardware?.batteryStateReporter) == "string" &&
        typeof(device.data?.hardware?.batteryStateMapping) == "object" &&
        typeof(device.data?.hardware?.batteryLevelReporter) == "string"
    )
    ) {
        // Invalid device description for battery
        return Promise.resolve({
            state: null,
            level: 100
        });
    }

    try {
        return Promise.resolve({
            state: device.data?.hardware?.batteryStateMapping?.[fs.readFileSync(String(device.data?.hardware.batteryStateReporter), "utf8").split("\n")[0]] || null,
            level: parseInt(fs.readFileSync(String(device.data?.hardware.batteryLevelReporter), "utf8").split("\n")[0])
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

exports.setMediaFeatures = function(features = mediaFeatures) {
    mediaFeatures = features;

    return Promise.all(electron.webContents.getAllWebContents().map(function(webContents) {
        return webContents.debugger.sendCommand("Emulation.setEmulatedMedia", {
            features: Object.keys(features).map((name) => ({name, value: features[name]}))
        });
    }));
};

exports.setMediaFeature = function(name, value) {
    mediaFeatures[name] = value;

    return exports.setMediaFeatures();
};

exports.getMediaFeatures = function() {
    return Promise.resolve(mediaFeatures);
};

exports.bcryptHash = function(data, saltRounds) {
    return new Promise(function(resolve, reject) {
        bcryptjs.hash(data, saltRounds, function(error, hash) {
            if (error) {
                reject(error);

                return;
            }

            resolve(hash);
        });
    });
};

exports.bcryptCompare = function(data, hash) {
    return new Promise(function(resolve, reject) {
        bcryptjs.compare(data, hash, function(error, result) {
            if (error) {
                reject(error);

                return;
            }

            resolve(result);
        });
    });
};

exports.networkList = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve([]);
    }

    return exports.executeCommand("nmcli", ["--terse", "--escape", "yes", "--colors", "no", "--get-values", "name,type,active", "connection"]).then(function(output) {
        var lines = output.stdout.split("\n").filter((line) => line != "");

        return lines.map(function(line) {
            var data = exports.parseNmcliLine(line);

            return {
                name: data[0],
                type: {
                    "802-11-wireless": "wifi",
                    "802-3-ethernet": "ethernet"
                }[data[1]] || "unknown",
                connected: data[2] == "yes"
            };
        });
    });
};

exports.networkScanWifi = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve([]);
    }

    return exports.executeCommand("nmcli", ["--terse", "--escape", "yes", "--colors", "no", "--get-values", "ssid,bssid,chan,rate,signal,security", "device", "wifi", "list"]).then(function(output) {
        var lines = output.stdout.split("\n").filter((line) => line != "");

        return lines.map(function(line) {
            var data = exports.parseNmcliLine(line);

            return {
                name: data[0],
                bssid: data[1],
                channel: parseInt(data[2]),
                bandwidth: parseInt(data[3]),
                signal: parseInt(data[4]),
                security: data[5].split(" ").filter((data) => data != "").map((data) => ({
                    "WEP": "wep",
                    "WPA1": "wpa1",
                    "WPA2": "wpa2"
                }[data] || "unknown"))
            };
        });
    });
};

exports.devRestart = function() {
    if (!flags.isRealHardware) {
        electron.app.relaunch();
    }

    electron.app.exit();

    return Promise.resolve();
};