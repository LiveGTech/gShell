/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as webviewComms from "gshell://userenv/webviewcomms.js";
import * as network from "gshell://system/network.js";

export var data = {};

export var commands = {
    network_getList: network.getList(),
    network_scanWifi: network.scanWifi()
};

export function setData(name, dataValue) {
    data[name] = dataValue;

    webviewComms.update();
};