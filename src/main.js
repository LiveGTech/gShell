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

exports.IS_DEBUG_BUILD = true;

exports.rootDirectory = electron.app.isPackaged ? process.resourcesPath : path.join(__dirname, "/..");

var flags = require("./flags");
var system = require("./system");
var storage = require("./storage");
var device = require("./device");
var network = require("./network");
var monitors = require("./monitors");
var linux = require("./linux");
var control = require("./control");
var xorg = require("./xorg");
var ipc = require("./ipc");

exports.window = null;

exports.ensureDebuggerAttached = function(webContents) {
    if (!webContents.debugger.isAttached()) {
        webContents.debugger.attach("1.2");
    }
};

electron.app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");
electron.app.commandLine.appendSwitch("disable-site-isolation-trials");
electron.app.commandLine.appendSwitch("enable-speech-dispatcher");

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
        return linux.init();
    }).then(function() {
        return control.init();
    }).then(function() {
        return system.setupLinuxAppIntegration();
    }).then(function() {
        return network.updateProxy();
    }).then(function() {
        // TODO: Implement advanced audio management
        return system.executeOrLogCommand("wpctl", ["set-volume", "@DEFAULT_AUDIO_SINK@", "50%"]).catch(function(error) {
            console.warn(error);

            return Promise.resolve();
        });
    }).then(function() {
        return monitors.get();
    }).then(function(monitorData) {
        exports.window = new electron.BrowserWindow({
            width: monitorData.workArea.width + 1,
            height: monitorData.workArea.height + 1,
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

            xorg.init();
        });

        exports.window.loadFile("shell/index.html");
    });
});