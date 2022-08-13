/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var flags = require("./flags");
var config = require("./config");

exports.data = null;

exports.init = function(location = "device.gsc") {
    return config.read(location).then(function(data) {
        exports.data = data;

        exports.data.type = flags.deviceType || exports.data.type || "mobile";

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

        exports.data.display ||= {};
        exports.data.display.scaleFactor ||= 1;

        return Promise.resolve();
    })
};