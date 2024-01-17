/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as appManager from "gshell://userenv/appmanager.js";

export function addAppToList(processName) {
    return gShell.call("linux_getAppInfo", {processName}).then(function(appInfo) {
        console.log(appInfo);

        // TODO: Add via app manager
    });
}