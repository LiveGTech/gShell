/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const path = require("path");
const electron = require("electron");
const mkdirp = require("mkdirp");

var flags = require("./flags");

exports.storageFilesystemLocation = flags.isRealHardware ? "/system/storage" : path.normalize(`${electron.app.getPath("home")}/gShell/storage`);

exports.init = function() {
    electron.protocol.registerFileProtocol("storage", function(request, callback) {
        var url = request.url.substring("storage://".length);
    
        callback({path: path.normalize(`${exports.storageFilesystemLocation}/${url}`)});
    });

    // TODO: Implement `file:///` protocol for per-user file access

    mkdirp.sync(exports.storageFilesystemLocation);
    
    console.log(`Storage filesystem location: ${exports.storageFilesystemLocation}`);

    return Promise.resolve();
};