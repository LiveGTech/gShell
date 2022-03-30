/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as config from "gshell://config/config.js";
import * as input from "gshell://input/input.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

export var options = {
    touch_holdDelay: 500, // 500 milliseconds
    switch_enabled: false,
    switch_scanColour: "blue"
};

export function setOption(optionName, value) {
    options[optionName] = value;

    update();

    return config.edit("a11y.gsc", function(data) {
        data[optionName] = value;

        return Promise.resolve(data);
    });
}

export function load() {
    return config.read("a11y.gsc").then(function(data) {
        Object.keys(data).forEach(function(optionName) {
            options[optionName] = data[optionName];
        });

        update();

        return Promise.resolve();
    });
}

export function update() {
    $g.sel("body").setAttribute("liveg-a11y-scan", options.switch_enabled ? options.switch_scanColour : "");

    webviewComms.update();
}

export function init() {
    gShell.call("system_getFlags").then(function(flags) {
        if (flags.enableA11ySwitch) {
            options.switch_enabled = true;

            update();
        }
    });

    // TODO: Implement better scan loop
    setInterval(function() {
        if (!options.switch_enabled) {
            return;
        }

        gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyDown", keyCode: "tab", modifiers: []}});
        gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyUp", keyCode: "tab", modifiers: []}});
    }, 500);
}