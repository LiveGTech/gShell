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

export function disconnectWifi(name) {
    return gShell.call("network_disconnectWifi", {name});
}

export function forgetWifi(name) {
    return gShell.call("network_forgetWifi", {name});
}

export function configureWifi(name, auth) {
    return gShell.call("network_configureWifi", {name, auth});
}

export function connectWifi(name) {
    return gShell.call("network_connectWifi", {name});
}

export function init() {
    getList();
    scanWifi();

    setInterval(function() {
        getList();
    }, LIST_UPDATE_INTERVAL);

    setInterval(function() {
        scanWifi();
    }, WIFI_SCAN_INTERVAL);
}