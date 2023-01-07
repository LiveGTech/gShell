/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";
import * as auth from "gshell://auth/auth.js";
import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export function getGlobalConfig() {
    return config.read("personalisation.gsc");
}

export function getUserConfig() {
    return users.getCurrentUser().then(function(user) {
        if (user == null) {
            return Promise.resolve({});
        }

        return config.read(`users/${user.uid}/personalisation.gsc`);
    });
}

export function getConfig() {
    var globalConfigData;

    return getGlobalConfig().then(function(data) {
        globalConfigData = data;

        return getUserConfig();
    }).then(function(userConfigData) {
        return {
            ...globalConfigData,
            ...userConfigData
        };
    });
}

export function getConfigPath(global = false) {
    if (global) {
        return Promise.resolve("personalisation.gsc");
    }

    return users.ensureCurrentUser().then(function(user) {
        return Promise.resolve(`users/${user.uid}/personalisation.gsc`);
    });
}

export function setOption(optionName, value, global = undefined) {
    return getConfigPath(global).then(function(path) {
        return config.edit(path, function(data) {
            data[optionName] = value;

            return Promise.resolve(data);
        });
    }).then(function() {
        return update();
    });
}

export function init() {
    auth.onUserStateChange(function() {
        update();
    });
}

export function update() {
    return getConfig().then(function(data) {
        privilegedInterface.setData("personalisation_themeMode", data.themeMode || "light");

        gShell.call("shell_setColourScheme", {
            scheme: data.themeMode == "dark" ? "dark" : "light"
        });

        return Promise.resolve();
    });
}