/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";

export var options = {
    touch_holdDelay: 500 // 500 milliseconds
};

export function setOption(optionName, value) {
    options[optionName] = value;

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

        return Promise.resolve();
    });
}