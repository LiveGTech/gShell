/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var main = require("./main");

var pendingRequests = [];
var pendingUsbSelectionRequests = [];

var allowedPermissions = {}; // TODO: Ensure that this is cleared on user sign-out and permission settings changes
var allowedDeviceIds = {};

exports.attach = function(webContents) {
    webContents.session.setPermissionRequestHandler(function(webContents, permission, callback) {
        var requestId = pendingRequests.length;

        main.window.webContents.send("permissions_request", {
            requestId,
            webContentsId: webContents.id,
            permission
        });

        pendingRequests.push(callback);
    });

    webContents.session.setPermissionCheckHandler(function(webContents, permission, origin) {
        if (origin.startsWith("http://") || origin.startsWith("https://")) {
            origin = new URL(origin).origin; // To conform to same format used in renderer
        }

        if (["bluetooth", "usb", "serial"].includes(permission)) {
            return true;
        }

        return !!allowedPermissions[origin]?.[permission];
    });

    webContents.session.setDevicePermissionHandler(function(details) {
        return !!allowedDeviceIds[details.device.deviceId];
    });

    webContents.session.setUSBProtectedClassesHandler(function(details) {
        return [];
    });

    webContents.session.on("select-usb-device", function(event, details, callback) {
        event.preventDefault();

        var requestId = pendingUsbSelectionRequests.length;

        main.window.webContents.send("permissions_usbSelectionRequest", {
            requestId,
            webContentsId: webContents.id,
            devices: details.deviceList
        });

        pendingUsbSelectionRequests.push(callback);
    });

    webContents.session.on("usb-device-added", function(event, device) {
        main.window.webContents.send("permissions_addUsbDevice", {webContentsId: webContents.id, device});
    });

    webContents.session.on("usb-device-removed", function(event, device) {
        main.window.webContents.send("permissions_removeUsbDevice", {webContentsId: webContents.id, device});
    });
};

function callOnRequestQueue(requestQueue, requestId, response) {
    if (requestId >= requestQueue.length) {
        return Promise.reject("ID does not exist");
    }

    if (requestQueue[requestId] == null) {
        return Promise.reject("Request has already received a response");
    }

    requestQueue[requestId](response);

    requestQueue[requestId] = null;

    return Promise.resolve();
};

exports.respondToRequest = function(requestId, permission, origin, granted) {
    if (granted) {
        allowedPermissions[origin] ||= {};
        allowedPermissions[origin][permission] = true;
    }

    return callOnRequestQueue(pendingRequests, requestId, granted);
};

exports.respondToUsbSelectionRequest = function(requestId, selectedDeviceId) {
    if (selectedDeviceId != null) {
        allowedDeviceIds[selectedDeviceId] = true; // TODO: Allow per origin only
    }

    return callOnRequestQueue(pendingUsbSelectionRequests, requestId, selectedDeviceId);
};