/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export var sleeping = false;

export function enter() {
    $g.sel("#off").fadeIn().then(function() {
        $g.sel("#lockScreenMain").screenJump().then(function() {
            sleeping = true;

            gShell.call("power_sleep");
        });
    });
}

export function toggle() {
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