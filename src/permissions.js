/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var main = require("./main");

var pendingRequests = [];

var allowedPermissions = {}; // TODO: Ensure that this is cleared on user sign-out and permission settings changes

exports.attach = function(webContents) {
    webContents.session.setPermissionRequestHandler(function(webContents, permission, callback) {
        var requestId = pendingRequests.length;

        main.window.webContents.send("permissions_request", {
            webContentsId: webContents.id,
            permission,
            requestId
        });

        pendingRequests.push(callback);
    });

    webContents.session.setPermissionCheckHandler(function(webContents, permission, origin) {
        origin = new URL(origin).origin; // To conform to same format used in renderer

        if (["bluetooth", "usb", "serial"].includes(permission)) {
            return true;
        }

        return !!allowedPermissions[origin]?.[permission];
    });

    webContents.session.on("select-usb-device", function(event, details, callback) {
        event.preventDefault();

        console.log(details);
    });
};

exports.respondToRequest = function(requestId, permission, origin, granted) {
    if (requestId >= pendingRequests.length) {
        return Promise.reject("ID does not exist");
    }

    if (pendingRequests[requestId] == null) {
        return Promise.reject("Request has already received a response");
    }

    if (granted) {
        allowedPermissions[origin] ||= {};
        allowedPermissions[origin][permission] = true;
    }

    pendingRequests[requestId](granted);

    pendingRequests[requestId] = null;

    return Promise.resolve();
};