/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as device from "gshell://system/device.js";
import * as sleep from "gshell://system/sleep.js";

var powerButtonIsDown = false;
var powerButtonTimeout = null;

export function open(forceBlur = false) {
    var blur = device.data?.type != "desktop" || forceBlur;
    var user = !$g.sel("#switcherView").get().hidden;

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

export function init() {
    $g.sel("body").on("keydown", function(event) {
        if (powerButtonIsDown) {
            return;
        }

        powerButtonIsDown = true;

        if (event.key == "PowerOff") {
            clearTimeout(powerButtonTimeout);

            powerButtonTimeout = setTimeout(function() {
                open(true);

                powerButtonTimeout = null;
            }, 1_000);
        }
    });

    $g.sel("body").on("keyup", function(event) {
        powerButtonIsDown = false;

        if (event.key == "PowerOff") {
            if (powerButtonTimeout != null) {
                sleep.toggle();

                clearTimeout(powerButtonTimeout);

                powerButtonTimeout = null;
            }
        }
    });

    $g.sel(".powerMenu_lock").on("click", function() {
        $g.sel("#lockScreenMain").screenFade();
    });

    $g.sel(".powerMenu_shutDown").on("click", function() {
        gShell.call("power_shutDown");
    });

    $g.sel(".powerMenu_restart").on("click", function() {
        gShell.call("power_restart");
    });
}