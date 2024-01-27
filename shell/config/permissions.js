/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";
import * as webviewManager from "gshell://userenv/webviewmanager.js";

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
            return Promise.resolve("allow");
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
        var webview = webviewManager.webviewsByWebContentsId[data.webContentsId];

        if (!webview) {
            console.error("No webview found to respond to permission request");

            return;
        }

        var urlInfo = new URL(webview.get().getURL());

        function respond(granted) {
            gShell.call("permissions_respondToRequest", {
                requestId: data.requestId,
                permission: data.permission,
                origin: urlInfo.origin,
                granted
            });
        }

        getPermissionForOriginInContext(urlInfo.origin, data.permission, {
            secureContextOnly: urlInfo.protocol != "http:"
        }).then(function(grantStatus) {
            switch (grantStatus) {
                case "allow":
                    respond(true);
                    break;

                case "ask":
                    // TODO: Ask user whether to grant permission or not
                    console.log("Permission request needs responding to:", respond);
                    break;

                default:
                    respond(false);
                    break;
            }
        });
    });

    gShell.on("permissions_usbSelectionRequest", function(event, data) {
        var webview = webviewManager.webviewsByWebContentsId[data.webContentsId];

        if (!webview) {
            console.error("No webview found to respond to permission request");

            return;
        }

        function respond(selectedDeviceId) {
            gShell.call("permissions_respondToUsbSelectionRequest", {
                requestId: data.requestId,
                selectedDeviceId
            });
        }

        // TODO: Ask user for USB device to select
        console.log("USB device selection request needs responding to:", data.devices, respond);
    });
}