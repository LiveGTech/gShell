/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export const LIST_UPDATE_INTERVAL = 5 * 1_000; // 5 seconds
export const WIFI_SCAN_INTERVAL = 60 * 1_000; // 1 minute

export var listResults = [];
export var wifiScanResults = [];

export function getList() {
    return gShell.call("network_list").then(function(data) {
        listResults = data;

        privilegedInterface.setData("network_listResults", data);

        return Promise.resolve(data);
    });
}

export function scanWifi() {
    return gShell.call("network_scanWifi").then(function(data) {
        wifiScanResults = data;

        privilegedInterface.setData("network_wifiScanResults", data);

        return Promise.resolve(data);
    });
}

export function init() {
    setInterval(function() {
        getList();
    }, LIST_UPDATE_INTERVAL);

    setInterval(function() {
        scanWifi();
    }, WIFI_SCAN_INTERVAL);
}