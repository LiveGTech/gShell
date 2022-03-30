/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as a11y from "gshell://a11y/a11y.js";
import * as input from "gshell://input/input.js";

export function attach(webview) {
    webview.on("ipc-message", function(event) {
        switch (event.channel) {
            case "input_show":
                input.show();
                break;

            case "input_hide":
                input.hide();
                break;
        }
    });
}

export function update(webview = $g.sel("webview")) {
    webview.getAll().forEach(function(element) {
        element.send("update", {
            a11y_options: a11y.options
        });
    });
}