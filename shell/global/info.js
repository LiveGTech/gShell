/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export function applyDateTime() {
    $g.sel(".info_date").setText(_format(new Date(), {weekday: "long", day: "numeric", month: "long"}));
    $g.sel(".info_time").setText(_format(new Date(), {timeStyle: "short"}));
}

export function applyPower() {
    gShell.call("power_getState").then(function(response) {
        if (response.state == null) {
            $g.sel(".info_batteryLevel").setText("");

            return;
        }

        $g.sel(".info_batteryLevel").setText(_("percentage", {value: response.level}));
    });
}

export function applyAll() {
    applyDateTime();
    applyPower();
}

export function init() {
    applyAll();

    setInterval(function() {
        applyDateTime();
    });

    setInterval(function() {
        applyPower();
    }, 3_000);
}