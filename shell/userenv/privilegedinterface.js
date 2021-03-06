/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as webviewComms from "gshell://userenv/webviewcomms.js";
import * as network from "gshell://system/network.js";
import * as a11y from "gshell://a11y/a11y.js";

export var data = {};

export var commands = {
    network_getList: network.getList(),
    network_scanWifi: network.scanWifi(),
    a11y_setOption: (data) => a11y.setOption(data.name, data.value)
};

export function setData(name, dataValue) {
    data[name] = dataValue;

    webviewComms.update();
};