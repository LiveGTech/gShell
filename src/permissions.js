/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var main = require("./main");

var pendingRequests = [];

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
        if (["bluetooth", "usb", "serial"].includes(permission)) {
            return true;
        }

        return false;
    });

    webContents.session.on("select-usb-device", function(event, details, callback) {
        event.preventDefault();

        console.log(details);
    });
};