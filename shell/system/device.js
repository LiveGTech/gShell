/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export var data = {};
export var touchActive = false;

export function setTouchActive(value) {
    touchActive = value;
}

export function init() {
    return gShell.call("system_getDevice").then(function(deviceData) {
        data = deviceData;

        $g.sel("body").setAttribute("device-type", data?.type);

        touchActive = data?.type != "desktop";

        privilegedInterface.setData("device_data", data);

        return Promise.resolve();
    });
}