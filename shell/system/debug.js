/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as about from "gshell://about.js";

export function init() {
    gShell.call("dev_isDebugBuild").then(function(result) {
        if (!result) {
            return;
        }

        $g.sel(".debug_buildMessage").clear().add(
            ...[
                `LiveG OS/gShell ${about.VERSION} (${about.VERNUM})`,
                "Debug build (not for main release)"
            ].map((line) => $g.create("p").setText(line))
        );

        $g.sel(".debug_buildMessage").show();
    });
}