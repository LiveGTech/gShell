/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";
import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export var options = {
    researchTelemetryEnabled: false,
    notifyResearchChanges: false
};

export function setOption(optionName, value) {
    options[optionName] = value;

    privilegedInterface.setData("interaction_options", options);

    return config.edit("interaction.gsc", function(data) {
        data[optionName] = value;

        return Promise.resolve(data);
    });
}

export function load() {
    return config.read("interaction.gsc").then(function(data) {
        Object.keys(data).forEach(function(optionName) {
            if (!options.hasOwnProperty(optionName)) {
                return;
            }

            options[optionName] = data[optionName];
        });

        privilegedInterface.setData("interaction_options", options);

        return Promise.resolve();
    });
}