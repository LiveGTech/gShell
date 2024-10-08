/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as system from "gshell://system/system.js";
import * as device from "gshell://system/device.js";
import * as sleep from "gshell://system/sleep.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

var powerButtonIsDown = false;
var powerMenuTriggered = false;
var powerButtonTimeout = null;

export function open(forceBlur = false) {
    var blur = device.data?.type != "desktop" || forceBlur;
    var user = !$g.sel("#home").get().hidden || !$g.sel("#switcherView").get().hidden;

    if (blur) {
        if (user) {
            $g.sel(".powerMenu_userBlur").menuOpen();
        } else {
            $g.sel(".powerMenu_basicBlur").menuOpen();
        }
    } else {
        if (user) {
            $g.sel(".powerMenu_user").menuOpen();
        } else {
            $g.sel(".powerMenu_basic").menuOpen();
        }
    }
}

export function close() {
    $g.sel(".powerMenu_basic").menuClose();
    $g.sel(".powerMenu_basicBlur").menuClose();
    $g.sel(".powerMenu_user").menuClose();
    $g.sel(".powerMenu_userBlur").menuClose();
}

export function handlePowerButtonDown() {
    if (powerButtonIsDown) {
        return;
    }

    powerButtonIsDown = true;
    powerMenuTriggered = false;

    clearTimeout(powerButtonTimeout);

    powerButtonTimeout = setTimeout(function() {
        open(true);

        powerMenuTriggered = true;
        powerButtonTimeout = null;
    }, 1_000);
}

export function handlePowerButtonUp() {
    if (!powerButtonIsDown) {
        return;
    }

    powerButtonIsDown = false;

    if (!powerMenuTriggered) {
        sleep.toggle();
    }

    clearTimeout(powerButtonTimeout);

    powerButtonTimeout = null;
}

export function init() {
    $g.sel("body").on("keydown", function(event) {
        if (event.key == "PowerOff") {
            handlePowerButtonDown();
        }
    });

    webviewComms.onEvent("keydown", function(event) {
        if (event.key == "PowerOff") {
            handlePowerButtonDown();
        }
    });

    gShell.on("xorg_powerButtonDown", function() {
        handlePowerButtonDown();
    });

    $g.sel("body").on("keyup", function(event) {
        if (event.key == "PowerOff") {
            handlePowerButtonUp();
        }
    });

    webviewComms.onEvent("keyup", function(event) {
        if (event.key == "PowerOff") {
            handlePowerButtonUp();
        }
    });

    gShell.on("xorg_powerButtonUp", function() {
        handlePowerButtonUp();
    });

    $g.sel(".powerMenu_lock").on("click", function() {
        $g.sel("#lockScreenMain").screenFade();
    });

    $g.sel(".powerMenu_sleep").on("click", function() {
        sleep.enter();
    });

    $g.sel(".powerMenu_shutDown").on("click", function() {
        system.shutDown();
    });

    $g.sel(".powerMenu_restart").on("click", function() {
        system.restart();
    });
}