/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export var data = {};
export var touchActive = false;

var touchEventFired = false;

export function init() {
    $g.sel("body").on("touchstart", function(event) {
        touchActive = true;
        touchEventFired = true;
    });

    $g.sel("body").on("mousedown", function(event) {
        if (!touchEventFired) {
            touchActive = false;
        }

        touchEventFired = false;
    });

    return gShell.call("system_getDevice").then(function(deviceData) {
        data = deviceData;

        $g.sel("body").setAttribute("device-type", data?.type);

        touchActive = data?.type != "desktop";

        return Promise.resolve();
    });
}