/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";
import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export var options = {
    touch_holdDelay: 500, // 500 milliseconds
    touch_doublePressDelay: 500, // 500 milliseconds

    switch_enabled: false,
    switch_scanColour: "blue",
    switch_itemScanPeriod: 500, // 500 milliseconds
    switch_itemScanAfterConfirmPeriod: 1_000 // 1 second
};

export var modules = {};

export var assistiveTechnologies = [];

export class AssistiveTechnology {
    init() {}

    update() {}
}

export function registerAssistiveTechnology(tech) {
    assistiveTechnologies.push(new tech());
}

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

export function init() {
    gShell.call("system_getFlags").then(function(flags) {
        if (flags.enableA11ySwitch) {
            options.switch_enabled = true;

            update();
        }
    });

    Promise.all([
        import("gshell://a11y/switch.js")
    ]).then(function(loadedModules) {
        loadedModules.forEach(function(module) {
            modules[module.NAME] = module;
        });

        assistiveTechnologies.forEach((tech) => tech.init());

        update();
    });
}

export function update() {
    assistiveTechnologies.forEach((tech) => tech.update());

    privilegedInterface.setData("a11y_options", options);
    webviewComms.update();
}