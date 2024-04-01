/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export var webContentsId = $g.core.parameter("wcid");

export function call(command, data = {}) {
    if (webContentsId == null) {
        return Promise.reject("No web contents ID is set");
    }

    return _sphere.callPrivilegedCommand("investigator_call", {webContentsId, command, data});
}

export function on(eventType, callback) {
    if (webContentsId == null) {
        return;
    }

    _sphere.onPrivilegedDataEvent("investigator_event", function(data) {
        if (data.type == eventType) {
            callback(data);
        }
    });

    _sphere.callPrivilegedCommand("investigator_listenToEvent", {webContentsId, eventType});
}