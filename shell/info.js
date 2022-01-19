/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

$g.waitForLoad().then(function() {
    setInterval(function() {
        // TODO: Use `l10n` to obtain these values
        $g.sel(".info_date").setText(new Date().toLocaleString("en-GB", {weekday: "long", day: "numeric", month: "long"}));
        $g.sel(".info_time").setText(new Date().toLocaleString("en-GB", {timeStyle: "short"}));
    });

    setInterval(function() {
        gShell.call("power_getState").then(function(response) {
            if (response.state == null) {
                $g.sel(".info_battery").setText("");
    
                return;
            }
    
            $g.sel(".info_battery").setText(`${response.level}%${response.state == "charging" ? "C": ""}`);
        });
    }, 3_000);
});