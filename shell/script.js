/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as info from "gshell://info.js";
import * as lockScreen from "gshell://lockscreen.js";

window.$g = $g;

var sleeping = false;

function enterSleep() {
    if (sleeping) {
        return;
    }

    sleeping = true;

    $g.sel("#lockScreenMain").screenJump().then(function() {
        gShell.call("power_sleep");
    });

    setTimeout(function() {
        sleeping = false;
    }, 2_000);
}

$g.waitForLoad().then(function() {
    $g.sel("body").on("keydown", function(event) {
        switch (event.key) {
            case "PowerOff":
                enterSleep();
                break;
        }
    });

    $g.sel("#otherPageButton").on("click", function() {
        $g.sel("#otherPage").screenForward();
    });

    $g.sel("#lockButton").on("click", function() {
        $g.sel("#mainMenu").asideClose().then(function() {
            $g.sel("#lockScreenMain").screenFade();
        });
    });

    $g.sel("#shutDownButton").on("click", function() {
        gShell.call("power_shutDown");
    });

    $g.sel("#devRestartButton").on("click", function() {
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

    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function(event) {
        $g.sel("#darkTheme").setValue(event.matches);
    });

    $g.sel("#darkTheme").on("change", function() {
        gShell.call("shell_setColourScheme", {
            scheme: $g.sel("#darkTheme").getValue() ? "dark" : "light"
        });
    });
});