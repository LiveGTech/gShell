/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export var data = {};

export function init() {
    return gShell.call("system_getDevice").then(function(deviceData) {
        data = deviceData;

        $g.sel("body").setAttribute("device-type", data?.type);

        return Promise.resolve();
    });
}