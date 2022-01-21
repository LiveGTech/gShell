/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

const ENTER_SLEEP_TIME = 4_000;

export var sleeping = false;
export var lastSleepTime = null;

export function enter() {
    lastSleepTime = new Date().getTime();

    $g.sel("#off").fadeIn().then(function() {
        $g.sel("#lockScreenMain").screenJump().then(function() {
            sleeping = true;

            gShell.call("power_sleep");
        });
    });
}

export function toggle() {
    if (lastSleepTime != null && new Date().getTime() - lastSleepTime < ENTER_SLEEP_TIME) {
        return;
    }

    if (sleeping) {
        sleeping = false;

        $g.sel("#off").fadeOut();

        return;
    } else {
        enter();
    }
}

$g.waitForLoad().then(function() {
    $g.sel("body").on("keydown", function(event) {
        if (event.key == "PowerOff") {
            toggle();
        }
    });
});