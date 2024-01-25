/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";

export const DEFAULT_PERMISSIONS = {
    term: "ask"
};

export const PERMISSION_CONTEXTS = {
    term: {secureContextOnly: false, askInAppOnly: true}
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

export function getPermissionsForScope(scope) {
    var globalConfigData;

    return getGlobalConfig().then(function(data) {
        globalConfigData = data;

        return getUserConfig();
    }).then(function(userConfigData) {
        return {
            ...DEFAULT_PERMISSIONS,
            ...((globalConfigData.scopes || {})[scope] || {}),
            ...((userConfigData.scopes || {})[scope] || {})
        };
    });
}

export function getPermissionForScopeInContext(scope, permission, context = {}) {
    return getPermissionsForScope(scope).then(function(permissions) {
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

export function setPermissionForScope(scope, permission, value, global = false) {
    return getConfigPath(global).then(function(path) {
        return config.edit(path, function(data) {
            data.scopes ||= {};
            data.scopes[scope] ||= {};
            data.scopes[scope][permission] = value;

            return Promise.resolve(data);
        });
    });
}