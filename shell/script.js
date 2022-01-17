/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "./lib/adaptui/src/adaptui.js";

$g.waitForLoad().then(function() {
    $g.sel("#shutDownButton").on("click", function() {
        gShell.call("power_shutDown");
    });

    $g.sel(".devRestartButton").on("click", function() {
        gShell.call("dev_restart");
    });

    gShell.call("system_getFlags").then(function(flags) {
        if (flags.isRealHardware) {
            $g.sel("#flagInfo").setText("Running on real hardware!");
        } else {
            $g.sel("#flagInfo").setText("Running in simulator!");
        }
    });

    function checkStatus() {
        gShell.call("power_getState").then(function(response) {
            if (response.state == null) {
                $g.sel("#batteryStatus").setText("No battery detected");
    
                return;
            }
    
            $g.sel("#batteryStatus").setText(`Battery: ${response.state}, ${response.level}%`);
        });
    }

    setInterval(checkStatus, 5_000);
    checkStatus();
});