#!/usr/bin/env node

/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const path = require("path");
const electron = require("electron");

var flags = require("./flags");
var system = require("./system");
var ipc = require("./ipc");

exports.window = null;

electron.app.on("ready", function() {
    system.getScreenResolution().then(function(resolution) {
        exports.window = new electron.BrowserWindow({
            width: resolution.width,
            height: resolution.height,
            show: false,
            fullscreen: flags.isRealHardware,
            webPreferences: {
                preload: path.join(__dirname, "../shell/preload.js")
            }
        });
    
        exports.window.setMenuBarVisibility(false);
        exports.window.setBackgroundColor("#000000");

        if (flags.isRealHardware) {
            exports.window.setPosition(0, 0);
            exports.window.webContents.setZoomFactor(5);
        }
    
        exports.window.loadFile("shell/index.html");

        exports.window.show();
    });
});