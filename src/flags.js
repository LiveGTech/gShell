/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const minimist = require("minimist");

exports.argv = minimist(process.argv.slice(2));

exports.isRealHardware = !!exports.argv["real"];
exports.allowHostControl = !!exports.argv["allow-host-control"];
exports.emulateInstallationMedia = !!exports.argv["im-emulation"];
exports.emulateTouch = !exports.isRealHardware && exports.argv["touch-emulation"] != false;
exports.deviceDescriptionLocation = exports.argv["device-desc-location"] || null;
exports.deviceType = exports.argv["device-type"] || null;
exports.inXephyr = !!exports.argv["in-xephyr"];
exports.allowXorgWindowManagement = exports.isRealHardware || exports.inXephyr || !!exports.argv["allow-xorg-window-management"];

exports.enableA11yReadout = !!exports.argv["enable-a11y-readout"];
exports.enableA11ySwitch = !!exports.argv["enable-a11y-switch"];

exports.devTools = !!exports.argv["devtools"];
exports.keepDevShortcuts = !!exports.argv["keep-dev-shortcuts"];
exports.ignoreDevShortcuts = !!exports.argv["ignore-dev-shortcuts"];