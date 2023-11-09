/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

var main = require("./main");
var flags = require("./flags");
var system = require("./system");
var storage = require("./storage");
var device = require("./device");
var config = require("./config");
var term = require("./term");
var xorg = require("./xorg");

var ipcMain = electron.ipcMain;

ipcMain.handle("system_getRootDirectory", function(event, data) {
    return system.getRootDirectory();
});

ipcMain.handle("system_getFlags", function(event, data) {
    return system.getFlags();
});

ipcMain.handle("system_getDevice", function(event, data) {
    return system.getDevice();
});

ipcMain.handle("system_registerAbortController", function(event, data) {
    return system.registerAbortController();
});

ipcMain.handle("system_triggerAbortController", function(event, data) {
    return system.triggerAbortController(data.id);
});

ipcMain.handle("system_executeCommand", function(event, data) {
    return system.executeOrLogCommand(data.command, data.args, data.stdin, null, data.options, data.abortControllerId);
});

ipcMain.handle("system_isInstallationMedia", function(event, data) {
    return system.isInstallationMedia();
});

ipcMain.handle("system_copyFiles", function(event, data) {
    return system.copyFiles(data.source, data.destination, data.privileged, data.exclude);
});

ipcMain.handle("system_getCopyFileInfo", function(event, data) {
    return system.getCopyFileInfo(data.id);
});

ipcMain.handle("system_extractArchive", function(event, data) {
    return system.extractArchive(data.source, data.destination, data.getProcessId);
});

ipcMain.handle("system_getExtractArchiveInfo", function(event, data) {
    return system.getExtractArchiveInfo(data.id);
});

ipcMain.handle("system_aptInstallPackages", function(event, data) {
    return system.aptInstallPackages(data.packageNames, data.downloadOnly);
});

ipcMain.handle("system_getAptInstallationInfo", function(event, data) {
    return system.getAptInstallationInfo(data.id);
});

ipcMain.handle("system_getLinuxUsersList", function(event, data) {
    return system.getLinuxUsersList();
});

ipcMain.handle("storage_getPath", function(event, data) {
    return storage.getPath(data.location);
});

ipcMain.handle("storage_read", function(event, data) {
    return storage.read(data.location, data.encoding);
});

ipcMain.handle("storage_write", function(event, data) {
    return storage.write(data.location, data.data, data.encoding, data.append);
});

ipcMain.handle("storage_delete", function(event, data) {
    return storage.delete(data.location);
});

ipcMain.handle("storage_move", function(event, data) {
    return storage.move(data.location, data.newLocation);
});

ipcMain.handle("storage_newFolder", function(event, data) {
    return storage.newFolder(data.location, data.parentOnly);
});

ipcMain.handle("storage_listFolder", function(event, data) {
    return storage.listFolder(data.location);
});

ipcMain.handle("storage_stat", function(event, data) {
    return storage.stat(data.location);
});

ipcMain.handle("storage_exists", function(event, data) {
    return storage.exists(data.location);
});

ipcMain.handle("config_read", function(event, data) {
    return config.read(data.location);
});

ipcMain.handle("config_write", function(event, data) {
    return config.write(data.location, data.data);
});

ipcMain.handle("auth_bcryptHash", function(event, data) {
    return system.bcryptHash(data.data, data.saltRounds);
});

ipcMain.handle("auth_bcryptCompare", function(event, data) {
    return system.bcryptCompare(data.data, data.hash);
});

ipcMain.handle("shell_setColourScheme", function(event, data) {
    return system.setColourScheme(data.scheme);
});

ipcMain.handle("power_shutDown", function(event, data) {
    system.shutDown();

    return Promise.resolve();
});

ipcMain.handle("power_restart", function(event, data) {
    system.restart();

    return Promise.resolve();
});

ipcMain.handle("power_sleep", function(event, data) {
    system.sleep();

    return Promise.resolve();
});

ipcMain.handle("power_getState", function(event, data) {
    return system.getPowerState();
});

ipcMain.handle("network_list", function(event, data) {
    return system.networkList();
});

ipcMain.handle("network_scanWifi", function(event, data) {
    return system.networkScanWifi();
});

ipcMain.handle("network_disconnectWifi", function(event, data) {
    return system.networkDisconnectWifi(data.name);
});

ipcMain.handle("network_forgetWifi", function(event, data) {
    return system.networkForgetWifi(data.name);
});

ipcMain.handle("network_configureWifi", function(event, data) {
    return system.networkConfigureWifi(data.name, data.auth);
});

ipcMain.handle("network_connectWifi", function(event, data) {
    return system.networkConnectWifi(data.name);
});

ipcMain.handle("network_getContentLength", function(event, data) {
    return system.getContentLength(data.url);
});

ipcMain.handle("network_downloadFile", function(event, data) {
    return system.downloadFile(data.url, data.destination, data.getProcessId);
});

ipcMain.handle("network_getDownloadFileInfo", function(event, data) {
    return system.getDownloadFileInfo(data.id);
});

ipcMain.handle("network_pauseFileDownload", function(event, data) {
    return system.pauseFileDownload(data.id);
});

ipcMain.handle("network_resumeFileDownload", function(event, data) {
    return system.resumeFileDownload(data.id);
});

ipcMain.handle("network_cancelFileDownload", function(event, data) {
    return system.cancelFileDownload(data.id);
});

ipcMain.handle("io_input", function(event, data) {
    var webContents = electron.webContents.fromId(data.webContentsId);

    webContents.focus();
    webContents.sendInputEvent(data.event);

    return Promise.resolve();
});

ipcMain.handle("io_focus", function(event, data) {
    main.window.focus();
    electron.webContents.fromId(data.webContentsId).focus();

    setTimeout(function() {
        return Promise.resolve();        
    });
});

ipcMain.handle("io_setKeyboardLayout", function(event, data) {
    return system.setKeyboardLayout(data.layout, data.variant);
});

ipcMain.handle("io_getPointerPosition", function(event, data) {
    var pointerPoint = electron.screen.getCursorScreenPoint();
    var offsetPoint = main.window.getContentBounds();

    return Promise.resolve({
        x: pointerPoint.x - offsetPoint.x,
        y: pointerPoint.y - offsetPoint.y
    });
});

ipcMain.handle("webview_attach", function(event, data) {
    var webContents = electron.webContents.fromId(data.webContentsId);

    if (flags.isRealHardware) {
        webContents.setZoomFactor(device.data.display.scaleFactor);
    } else {
        webContents.setZoomFactor(1);
    }

    webContents.setWindowOpenHandler(function(details) {
        // TODO: Include other data passed to `window.open`, including referrer

        webContents.send("openFrame", {
            webContentsId: data.webContentsId,
            url: details.url
        });

        return {action: "deny"};
    })

    main.ensureDebuggerAttached(webContents);

    return webContents.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: 0,
        height: 0,
        deviceScaleFactor: device.data.display.scaleFactor,
        scale: device.data.display.scaleFactor,
        mobile: device.data?.type == "mobile"
    }).then(function() {
        return webContents.debugger.sendCommand("Emulation.setUserAgentOverride", {
            userAgent: data.userAgent,
            userAgentMetadata: data.userAgentMetadata
        });
    }).then(function() {
        return system.setLocale();
    }).then(function() {
        // We must re-apply media features since the new webview won't have them yet
        return system.setMediaFeatures();
    });
});

ipcMain.handle("webview_send", function(event, data) {
    var webContents = electron.webContents.fromId(data.webContentsId);

    webContents.send(data.message, data.data);

    if (data.sendToSubframes) {
        webContents.mainFrame.frames.forEach(function(frame) {
            frame.send(data.message, data.data);
        });
    }

    return Promise.resolve();
});

ipcMain.handle("webview_setMediaFeatures", function(event, data) {
    return system.setMediaFeatures(data.features);
});

ipcMain.handle("webview_setMediaFeature", function(event, data) {
    return system.setMediaFeature(data.name, data.value);
});

ipcMain.handle("webview_getMediaFeatures", function(event, data) {
    return system.getMediaFeatures();
});

ipcMain.handle("webview_acknowledgeUserAgent", function(event, data) {
    return system.acknowledgeUserAgent(data.userAgent);
});

ipcMain.handle("webview_setLocale", function(event, data) {
    return system.setLocale(data.localeCode);
});

ipcMain.handle("webview_getManifest", function(event, data) {
    var webContents = electron.webContents.fromId(data.webContentsId);

    return new Promise(function(resolve, reject) {
        if (!webContents.isLoadingMainFrame()) {
            resolve();

            return;
        }

        webContents.on("did-finish-load", function() {
            resolve();
        });
    }).then(function() {
        return webContents.debugger.sendCommand("Page.getAppManifest");
    }).then(function(manifestData) {
        var returnData = {
            isPresent: false,
            isValid: false,
            manifest: null,
            manifestUrl: null,
            scope: null
        };

        if (manifestData?.parsed?.scope) {
            returnData.isPresent = true;
            returnData.manifestUrl = manifestData.url;
            returnData.scope = manifestData.parsed.scope;
        }

        try {
            returnData.manifest = JSON.parse(manifestData?.data);
            returnData.isPresent = true;
            returnData.isValid = true;
        } catch (e) {}

        return Promise.resolve(returnData);
    });
});

ipcMain.handle("term_spawn", function(event, data) {
    var id = null;

    return term.spawn(
        data.file,
        function(data) {
            main.window.webContents.send("term_read", {id, data});
        },
        function(exitCode, signal) {
            main.window.webContents.send("term_exit", {id, exitCode, signal});
        },
        data.args,
        data.options
    ).then(function(idValue) {
        id = idValue;

        return Promise.resolve(id);
    });
});

ipcMain.handle("term_kill", function(event, data) {
    return term.kill(data.id, data.signal);
});

ipcMain.handle("term_write", function(event, data) {
    return term.write(data.id, data.data);
});

ipcMain.handle("term_setSize", function(event, data) {
    return term.setSize(data.id, data.columns, data.rows);
});

ipcMain.handle("xorg_moveWindow", function(event, data) {
    return xorg.moveWindow(data.id, data.x, data.y);
});

ipcMain.handle("xorg_resizeWindow", function(event, data) {
    return xorg.resizeWindow(data.id, data.width, data.height);
});

ipcMain.handle("dev_isDebugBuild", function(event, data) {
    return Promise.resolve(main.IS_DEBUG_BUILD);
});

ipcMain.handle("dev_restart", function(event, data) {
    system.devRestart();

    return Promise.resolve();
});