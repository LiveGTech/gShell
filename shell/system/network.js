/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export const LIST_UPDATE_INTERVAL = 5 * 1_000; // 5 seconds
export const WIFI_SCAN_INTERVAL = 20 * 1_000; // 20 seconds
export const WIFI_CONNECTING_SCAN_INTERVAL = 2 * 1_000; // 2 seconds

export var listResults = [];
export var wifiScanResults = [];
export var wifiStateChanging = false;
export var wifiTargetStateIsConnected = false;

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
    wifiStateChanging = true;
    wifiTargetStateIsConnected = false;

    return gShell.call("network_disconnectWifi", {name});
}

export function forgetWifi(name) {
    wifiStateChanging = true;
    wifiTargetStateIsConnected = false;
    
    return gShell.call("network_forgetWifi", {name});
}

export function configureWifi(name, auth) {
    return gShell.call("network_configureWifi", {name, auth});
}

export function connectWifi(name) {
    wifiStateChanging = true;
    wifiTargetStateIsConnected = true;

    privilegedInterface.setData("network_connectingToWifi", name);

    return gShell.call("network_connectWifi", {name}).then(function(status) {
        if (status != "connected") {
            wifiStateChanging = false;
            wifiTargetStateIsConnected = false;

            privilegedInterface.setData("network_connectingToWifi", null);
        }

        return Promise.resolve(status);
    }).catch(function(error) {
        wifiStateChanging = false;
        wifiTargetStateIsConnected = false;

        privilegedInterface.setData("network_connectingToWifi", null);

        return Promise.reject(error);
    });
}

export function getProxy() {
    return gShell.call("network_getProxy");
}

export function setProxy(data) {
    return gShell.call("network_setProxy", data);
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

    setInterval(function() {
        if (!wifiStateChanging) {
            return;
        }

        scanWifi();

        var connected = !!wifiScanResults.find((result) => result.connected);

        if (
            (wifiTargetStateIsConnected && connected) ||
            (!wifiTargetStateIsConnected && !connected && wifiScanResults.length != 0)
        ) {
            wifiStateChanging = false;

            privilegedInterface.setData("network_connectingToWifi", null);
        }
    }, WIFI_CONNECTING_SCAN_INTERVAL);
}