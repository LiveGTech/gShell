#!/usr/bin/env node

/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const path = require("path");
const fs = require("fs");
const electron = require("electron");

var flags = require("./flags");
var system = require("./system");
var storage = require("./storage");
var ipc = require("./ipc");

exports.window = null;

electron.app.on("ready", function() {
    if (!fs.existsSync(path.join("shell", "lib", "adaptui", "src", "adaptui.js"))) {
        console.error("Missing required dependency: Adapt UI");
        console.error("Please ensure that you clone the required submodules to install the dependencies.");
        console.error("Read README.md for more information on how to do this.");

        process.exit(1);
    }

    electron.protocol.registerFileProtocol("gshell", function(request, callback) {
        var url = request.url.substring("gshell://".length);

        callback({path: path.normalize(`${__dirname}/../shell/${url}`)});
    });

    storage.init().then(function() {
        return system.getScreenResolution();
    }).then(function(resolution) {
        exports.window = new electron.BrowserWindow({
            width: resolution.width,
            height: resolution.height,
            show: false,
            fullscreen: flags.isRealHardware,
            backgroundColor: "#000000",
            webPreferences: {
                preload: path.normalize(`${__dirname}/../shell/preload.js`),
                webviewTag: true,
                sandbox: true
            }
        });
    
        exports.window.setMenuBarVisibility(false);

        electron.nativeTheme.themeSource = "light";

        if (flags.isRealHardware) {
            exports.window.setPosition(0, 0);
            exports.window.webContents.setZoomFactor(5);
        }

        exports.window.once("ready-to-show", function() {
            exports.window.show();
            exports.window.focus();
        });
    
        exports.window.loadFile("shell/index.html");
    });
});