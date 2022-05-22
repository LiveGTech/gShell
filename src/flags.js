/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const minimist = require("minimist");

exports.argv = minimist(process.argv.slice(2));

exports.isRealHardware = !!exports.argv["real"];
exports.emulateTouch = !exports.isRealHardware && exports.argv["touch-emulation"] != false;
exports.deviceDescriptionLocation = exports.argv["device-desc-location"] || null;
exports.deviceType = exports.argv["device-type"] || null;

exports.enableA11ySwitch = !!exports.argv["enable-a11y-switch"];