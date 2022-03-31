/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";
import * as input from "gshell://input/input.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

export class SwitchNavigation extends a11y.AssistiveTechnology {
    constructor() {
        super();

        this.itemScanNextAt = -Infinity;
    }

    init() {
        var thisScope = this;

        function keydownCallback(event) {
            switch (event.code) {
                case "Space":
                    thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanAfterConfirmPeriod;
                    break;
            }
        }

        $g.sel("body").on("keydown", keydownCallback);
        webviewComms.onEvent("keydown", keydownCallback);

        setInterval(function() {
            if (!a11y.options.switch_enabled) {
                return;
            }

            if (Date.now() - thisScope.itemScanNextAt < a11y.options.switch_itemScanPeriod) {
                return;
            }
    
            gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyDown", keyCode: "tab", modifiers: []}});
            gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyUp", keyCode: "tab", modifiers: []}});

            thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanPeriod;

            // TODO: Add wait time after confirming selection to allow for repeated confirmations
        });
    }

    update() {
        $g.sel("body").setAttribute("liveg-a11y-scan", a11y.options.switch_enabled ? a11y.options.switch_scanColour : "");
    }
}

a11y.registerAssistiveTechnology(SwitchNavigation);