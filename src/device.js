/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const fs = require("fs");

var main = require("./main");
var flags = require("./flags");
var config = require("./config");

const CHECK_LAPTOP_LID_SENSOR_INTERVAL = 1_000; // 1 second

exports.data = null;

exports.init = function(location = "device.gsc") {
    return config.read(location).then(function(data) {
        exports.data = data;

        exports.data.type = flags.deviceType || exports.data.type || "mobile";
        exports.data.platform ||= null;

        exports.data.model ||= {};
        exports.data.model.codename ||= "generic";
        exports.data.model.serial ||= null;
        exports.data.model.fallbackLocale ||= "en_GB";
        exports.data.model.name ||= {"en_GB": "Generic Device"};
        exports.data.model.manufacturer ||= {"en_GB": "Unknown"};

        exports.data.hardware ||= {};
        exports.data.hardware.batteryStateReporter ||= null;
        exports.data.hardware.batteryStateMapping ||= {
            "charging": "charging",
            "discharging": "discharging",
            "notCharging": "notCharging",
            "full": "full"
        };
        exports.data.hardware.batteryLevelReporter ||= null;
        exports.data.hardware.lidStateReporter ||= "/proc/acpi/button/lid/LID0/state";
        exports.data.hardware.lidStateClosedValue = "state:      closed";

        exports.data.display ||= {};
        exports.data.display.scaleFactor ||= 1;

        if (
            (flags.isRealHardware || flags.allowHostControl) &&
            exports.data.hardware.lidStateReporter != null &&
            fs.existsSync(exports.data.hardware.lidStateReporter)
        ) {
            var wasClosed = false;

            setInterval(function() {
                var result = fs.readFileSync(exports.data.hardware.lidStateReporter, "utf-8");
                var isClosed = result.replace(/\n$/, "") == exports.data.hardware.lidStateClosedValue;

                if (isClosed == wasClosed) {
                    return;
                }

                wasClosed = isClosed;

                main.window.webContents.send(isClosed ? "device_lidClose" : "device_lidOpen");

                console.log(`Lid state change: now ${isClosed ? "closed" : "open"}`);
            }, CHECK_LAPTOP_LID_SENSOR_INTERVAL);
        }

        return Promise.resolve();
    });
};