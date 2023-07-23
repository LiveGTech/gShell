/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as about from "gshell://about.js";
import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";

export const RUNTIME_UPDATE_INTERVAL = 1 * 60 * 1_000; // 1 minute

export var bootedAt = Date.now();

var lastRuntimeUpdate = Date.now();
var shutdownInProgress = false;

function recordUserSignedOut(reason = "userInitiated") {
    return users.getCurrentUser().then(function(user) {
        if (user == null) {
            return Promise.resolve();
        }

        return user.addToHistory("signedOut", {reason});
    });
}

export function addToHistory(eventType, data = {}) {
    return config.edit("system.gsc", function(allData) {
        allData.history ||= [];

        allData.history.push({
            eventType,
            ...data,
            performedAt: Date.now()
        });

        return Promise.resolve(allData);
    });
}

export function shutDown(reason = "userInitiated") {
    if (shutdownInProgress) {
        return Promise.reject("The system is already shutting down or restarting");
    }

    shutdownInProgress = true;

    return recordUserSignedOut("toShutDownSystem").then(function() {
        return addToHistory("shutdown", {reason});
    }).then(function() {
        return gShell.call("power_shutDown");
    });
}

export function restart(reason = "userInitiated") {
    if (shutdownInProgress) {
        return Promise.reject("The system is already shutting down or restarting");
    }

    shutdownInProgress = true;

    return recordUserSignedOut("toRestartSystem").then(function() {
        return addToHistory("restart", {reason});
    }).then(function() {
        return gShell.call("power_restart");
    });
}

export function init() {
    return config.edit("system.gsc", function(data) {
        data.firstBootedAt ??= bootedAt;
        data.lastBootedAt = bootedAt;
        data.runtimeDuration ||= 0;
        data.lastUptime ||= 0;
        data.firstInstalledVersion ||= about.VERSION;
        data.firstInstalledVernum ??= about.VERNUM;
        data.currentVersion = about.VERSION;
        data.currentVernum = about.VERNUM;

        data.bootCount ||= 0;
        data.bootCount++;

        data.history ||= [];

        data.history.push({
            eventType: "booted",
            performedAt: bootedAt
        });

        return Promise.resolve(data);
    }).then(function() {
        setInterval(function() {
            config.edit("system.gsc", function(data) {
                data.runtimeDuration ||= 0;
                data.runtimeDuration += Date.now() - lastRuntimeUpdate;

                data.lastUptime = Date.now() - bootedAt;

                lastRuntimeUpdate = Date.now();

                return Promise.resolve(data);
            });
        }, RUNTIME_UPDATE_INTERVAL);

        return Promise.resolve();
    });
}