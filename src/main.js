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

exports.IS_DEBUG_BUILD = false;

exports.rootDirectory = electron.app.isPackaged ? process.resourcesPath : path.join(__dirname, "/..");

var flags = require("./flags");
var system = require("./system");
var storage = require("./storage");
var device = require("./device");
var ipc = require("./ipc");

exports.window = null;

exports.ensureDebuggerAttached = function(webContents) {
    if (!webContents.debugger.isAttached()) {
        webContents.debugger.attach("1.2");
    }
};

electron.app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");
electron.app.commandLine.appendSwitch("disable-site-isolation-trials");

electron.protocol.registerSchemesAsPrivileged([
    {
        scheme: "gshell",
        privileges: {
            supportFetchAPI: true
        }
    },
    {
        scheme: "storage",
        privileges: {
            supportFetchAPI: true
        }
    }
]);

electron.app.on("ready", function() {
    if (!fs.existsSync(path.join(exports.rootDirectory, "shell", "lib", "adaptui", "src", "adaptui.js"))) {
        console.error("Missing required dependency: Adapt UI");
        console.error("Please ensure that you clone the required submodules to install the dependencies.");
        console.error("Read README.md for more information on how to do this.");

        process.exit(1);
    }

    electron.protocol.registerFileProtocol("gshell", function(request, callback) {
        var url = request.url.substring("gshell://".length).split("?")[0];

        callback({path: path.normalize(`${exports.rootDirectory}/shell/${url}`)});
    });

    storage.init().then(function() {
        return device.init(flags.deviceDescriptionLocation || undefined);
    }).then(function() {
        return system.getScreenResolution();
    }).then(function(resolution) {
        exports.window = new electron.BrowserWindow({
            width: resolution.width + 1,
            height: resolution.height + 1,
            show: false,
            backgroundColor: "#000000",
            webPreferences: {
                devTools: !flags.isRealHardware || exports.IS_DEBUG_BUILD || flags.devTools,
                preload: path.normalize(`${exports.rootDirectory}/shell/preload.js`),
                webviewTag: true,
                sandbox: true,
                nodeIntegrationInSubFrames: true,
                nodeIntegration: false
            }
        });

        if ((flags.isRealHardware && !exports.IS_DEBUG_BUILD && !flags.keepDevShortcuts) || flags.ignoreDevShortcuts) {
            exports.window.setMenu(null);
        }

        exports.window.once("ready-to-show", function() {
            exports.window.setMenuBarVisibility(false);

            exports.ensureDebuggerAttached(exports.window.webContents);

            electron.nativeTheme.themeSource = "light";

            exports.window.webContents.setZoomFactor(device.data.display.scaleFactor);

            if (flags.allowXorgWindowManagement) {
                exports.window.setPosition(0, 0);
            }

            if (flags.emulateTouch) {
                exports.window.webContents.debugger.sendCommand("Emulation.setEmitTouchEventsForMouse", {
                    enabled: true,
                    configuration: "mobile"
                });
            }

            if (flags.devTools) {
                exports.window.webContents.openDevTools();
            }

            exports.window.show();
            exports.window.focus();
        });
    
        exports.window.loadFile("shell/index.html");
    });
});