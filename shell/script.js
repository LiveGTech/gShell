/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as device from "gshell://system/device.js";
import * as l10n from "gshell://config/l10n.js";
import * as a11y from "gshell://a11y/a11y.js";
import * as users from "gshell://config/users.js";
import * as info from "gshell://global/info.js";
import * as sleep from "gshell://system/sleep.js";
import * as network from "gshell://system/network.js";
import * as input from "gshell://input/input.js";
import * as lockScreen from "gshell://auth/lockscreen.js";
import * as auth from "gshell://auth/auth.js";
import * as home from "gshell://userenv/home.js";
import * as switcher from "gshell://userenv/switcher.js";
import * as oobs from "gshell://oobs/oobs.js";
import * as sphere from "gshell://sphere/sphere.js";

window.$g = $g;

var oobsActivated = false;

$g.waitForLoad().then(function() {
    return $g.templates.apply();
}).then(function() {
    return device.init();
}).then(function() {
    return l10n.apply();
}).then(function() {
    return a11y.load();
}).then(function() {
    return users.getList();
}).then(function(userList) {
    if (userList.length == 0) {
        oobsActivated = true;

        return Promise.resolve();
    }

    return lockScreen.loadUsers();
}).then(function() {
    a11y.init();
    info.init();
    sleep.init();
    network.init();
    input.init();
    home.init();
    switcher.init();
    oobs.init();
    sphere.init();

    if (oobsActivated) {
        $g.sel("#oobs").screenFade();
    } else {
        $g.sel("#lockScreenMain").screenFade();
    }

    $g.sel("#openMenuButton").on("click", function() {
        $g.sel("#mainMenu").menuOpen();
    });

    $g.sel("#testPageButton").on("click", function() {
        $g.sel("#testPage").screenForward();
    });

    $g.sel("#lockButton").on("click", function() {
        $g.sel("#lockScreenMain").screenFade();
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

    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function(event) {
        $g.sel("#darkTheme").setValue(event.matches);
    });

    $g.sel("#darkTheme").on("change", function() {
        gShell.call("shell_setColourScheme", {
            scheme: $g.sel("#darkTheme").getValue() ? "dark" : "light"
        });
    });

    $g.sel("#switchNavigation").setValue(a11y.options.switch_enabled);

    $g.sel("#switchNavigation").on("change", function() {
        a11y.setOption("switch_enabled", $g.sel("#switchNavigation").getValue());
    });

    // users.get("test").then(function(user) {
    //     var credentials = new auth.UserAuthCredentials(user);

    //     credentials.load().then(function() {
    //         $g.sel("#passcodeAuth").setValue(credentials.authMethods[0] instanceof auth.PasscodeAuthMethod);
    //     });
    // });

    // $g.sel("#passcodeAuth").on("change", function() {
    //     users.get("test").then(function(user) {
    //         var credentials = new auth.UserAuthCredentials(user);

    //         credentials.load().then(function() {
    //             return $g.sel("#passcodeAuth").getValue() ? auth.PasscodeAuthMethod.generate("1234") : auth.UnsecureAuthMethod.generate();
    //         }).then(function(authMethod) {
    //             credentials.authMethods = [authMethod];

    //             credentials.save();
    //         });
    //     });
    // });

    $g.sel("#openSwitcher").on("click", function() {
        switcher.openApp("https://opensource.liveg.tech/Adapt-UI/demos/all/");
    });

    $g.sel("#deviceInfoTest").setText(JSON.stringify(device.data));

    $g.sel("#cameraTestButton").on("click", function() {
        if ("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia({video: true}).then(function(stream) {
                $g.sel("#cameraTest").get().srcObject = stream;

                $g.sel("#cameraTest").get().play();
            });
        }
    });
});