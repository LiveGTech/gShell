/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";

/*
    These permissions ask for user input before their main action can be carried
    out (such as selecting a device to connect to). Therefore, we do not need to
    ask the user whether to allow the permission in the first place.
*/
export const PERMISSIONS_DO_NOT_ASK = ["bluetooth", "usb", "serial"];

export const DEFAULT_PERMISSIONS = {
    bluetooth: "allow",
    usb: "allow",
    serial: "allow",
    term: "ask"
};

export const PERMISSION_CONTEXTS = {
    bluetooth: {secureContextOnly: true},
    usb: {secureContextOnly: true},
    serial: {secureContextOnly: true},
    term: {secureContextOnly: true, askInAppOnly: true}
};

export function getGlobalConfig() {
    return config.read("permissions.gsc");
}

export function getUserConfig() {
    return users.getCurrentUser().then(function(user) {
        if (user == null) {
            return Promise.resolve({});
        }

        return config.read(`users/${user.uid}/permissions.gsc`);
    });
}

export function getConfigPath(global = false) {
    if (global) {
        return Promise.resolve("permissions.gsc");
    }

    return users.ensureCurrentUser().then(function(user) {
        return Promise.resolve(`users/${user.uid}/permissions.gsc`);
    });
}

export function getPermissionsForOrigin(origin) {
    var globalConfigData;

    return getGlobalConfig().then(function(data) {
        globalConfigData = data;

        return getUserConfig();
    }).then(function(userConfigData) {
        return {
            ...DEFAULT_PERMISSIONS,
            ...((globalConfigData.origins || {})[origin] || {}),
            ...((userConfigData.origins || {})[origin] || {})
        };
    });
}

export function getPermissionForOriginInContext(origin, permission, context = {}) {
    return getPermissionsForOrigin(origin).then(function(permissions) {
        if (permissions[permission] == "deny") {
            return Promise.resolve("deny");
        }

        if (permissions[permission] == "allowInsecure") {
            return Promise.resolve("allowInsecure");
        }

        if (!context.isSecure && PERMISSION_CONTEXTS[permission]?.secureContextOnly) {
            return Promise.resolve("deny");
        }

        if (permissions[permission] == "allow") {
            return Promise.resolve("allow");
        }

        if (!context.isInApp && PERMISSION_CONTEXTS[permission]?.askInAppOnly) {
            return Promise.resolve("deny");
        }

        return Promise.resolve("ask");
    });
}

export function setPermissionForOrigin(origin, permission, value, global = false) {
    return getConfigPath(global).then(function(path) {
        return config.edit(path, function(data) {
            data.origins ||= {};
            data.origins[origin] ||= {};
            data.origins[origin][permission] = value;

            return Promise.resolve(data);
        });
    });
}

export function init() {
    gShell.on("permissions_request", function(event, data) {
        console.log("New permission request:", data);

        // TODO: Implement checks using `getPermissionForOriginInContext`
    });
}