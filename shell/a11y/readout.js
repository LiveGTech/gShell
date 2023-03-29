/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";

export const NAME = "readout";

export class ReadoutNavigation extends a11y.AssistiveTechnology {
    init() {
        console.log("Readout Navigation loaded");
    }

    update() {
        console.log("Readout Navigation state updated:", a11y.options.readout_enabled);
    }

    announce(data) {
        if (!a11y.options.readout_enabled) {
            return;
        }

        console.log("Readout Navigation announcement received:", data);
    }
}

a11y.registerAssistiveTechnology(ReadoutNavigation);