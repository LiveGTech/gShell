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
var network = require("./network");
var mobile = require("./mobile");
var monitors = require("./monitors");
var permissions = require("./permissions");
var term = require("./term");
var linux = require("./linux");
var control = require("./control");
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

ipcMain.handle("system_getProcessInfo", function(event, data) {
    return system.getProcessInfo(data.pid);
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
    return network.list();
});

ipcMain.handle("network_scanWifi", function(event, data) {
    return network.scanWifi();
});

ipcMain.handle("network_disconnectWifi", function(event, data) {
    return network.disconnectWifi(data.name);
});

ipcMain.handle("network_forgetWifi", function(event, data) {
    return network.forgetWifi(data.name);
});

ipcMain.handle("network_configureWifi", function(event, data) {
    return network.configureWifi(data.name, data.auth);
});

ipcMain.handle("network_connectWifi", function(event, data) {
    return network.connectWifi(data.name);
});

ipcMain.handle("network_getProxy", function(event, data) {
    return network.getProxy();
});

ipcMain.handle("network_setProxy", function(event, data) {
    return network.setProxy(data);
});

ipcMain.handle("network_getContentLength", function(event, data) {
    return network.getContentLength(data.url);
});

ipcMain.handle("network_downloadFile", function(event, data) {
    return network.downloadFile(data.url, data.destination, data.getProcessId);
});

ipcMain.handle("network_getDownloadFileInfo", function(event, data) {
    return network.getDownloadFileInfo(data.id);
});

ipcMain.handle("network_pauseFileDownload", function(event, data) {
    return network.pauseFileDownload(data.id);
});

ipcMain.handle("network_resumeFileDownload", function(event, data) {
    return network.resumeFileDownload(data.id);
});

ipcMain.handle("network_cancelFileDownload", function(event, data) {
    return network.cancelFileDownload(data.id);
});

ipcMain.handle("mobile_listModems", function(event, data) {
    return mobile.listModems();
});

ipcMain.handle("mobile_setModemActiveState", function(event, data) {
    return mobile.setModemActiveState(data.modemId, data.enable);
});

ipcMain.handle("mobile_getSignalInfo", function(event, data) {
    return mobile.getSignalInfo(data.modemId);
});

ipcMain.handle("mobile_setSignalPollInterval", function(event, data) {
    return mobile.setSignalPollInterval(data.modemId, data.interval);
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

ipcMain.handle("io_getMouseCursorPosition", function(event, data) {
    var cursorPoint = electron.screen.getCursorScreenPoint();
    var offsetPoint = main.window.getContentBounds();

    return Promise.resolve({
        x: cursorPoint.x - offsetPoint.x,
        y: cursorPoint.y - offsetPoint.y
    });
});

ipcMain.handle("io_getMonitors", function(event, data) {
    return monitors.get();
});

ipcMain.handle("io_setMonitors", function(event, data) {
    return monitors.set(data.monitors);
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
    });

    permissions.attach(webContents);

    main.ensureDebuggerAttached(webContents);

    var interval = setInterval(function() {
        if (webContents.isDestroyed()) {
            clearInterval(interval);

            return;
        }

        webContents.setZoomFactor(1);
    });

    return webContents.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: 0,
        height: 0,
        deviceScaleFactor: device.data.display.scaleFactor,
        scale: device.data.display.scaleFactor,
        mobile: device.data?.type == "mobile"
    }).then(function() {
        webContents.setZoomFactor(1);

        return webContents.debugger.sendCommand("Emulation.setUserAgentOverride", {
            userAgent: data.userAgent,
            userAgentMetadata: data.userAgentMetadata
        });
    }).then(function() {
        return system.setLocale();
    }).then(function() {
        // We must re-apply media features since the new webview won't have them yet
        return system.setMediaFeatures();
    }).then(function() {
        // We must re-apply network proxy config since the new webview won't have it set yet
        return network.updateProxy();
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

ipcMain.handle("webview_evaluate", function(event, data) {
    var webContents = electron.webContents.fromId(data.webContentsId ?? event.sender.id);

    main.ensureDebuggerAttached(webContents);

    return webContents.debugger.sendCommand("Runtime.evaluate", {
        expression: data.expression,
        allowUnsafeEvalBlockedByCSP: true
    }).then(function() {
        return Promise.resolve();
    });
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

ipcMain.handle("permissions_respondToRequest", function(event, data) {
    return permissions.respondToRequest(data.requestId, data.permission, data.origin, data.granted);
});

ipcMain.handle("permissions_respondToUsbSelectionRequest", function(event, data) {
    return permissions.respondToUsbSelectionRequest(data.requestId, data.selectedDeviceId);
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

ipcMain.handle("linux_getAppInfo", function(event, data) {
    return linux.getAppInfo(data.processName);
});

ipcMain.handle("linux_getControlFilesystemLocation", function(event, data) {
    return Promise.resolve(control.controlFilesystemLocation);
});

ipcMain.handle("xorg_getWindowProperties", function(event, data) {
    return xorg.getWindowProperties(data.id);
});

ipcMain.handle("xorg_getWindowGeometry", function(event, data) {
    return xorg.getWindowGeometry(data.id);
});

ipcMain.handle("xorg_moveWindow", function(event, data) {
    return xorg.moveWindow(data.id, data.x, data.y);
});

ipcMain.handle("xorg_resizeWindow", function(event, data) {
    return xorg.resizeWindow(data.id, data.width, data.height);
});

ipcMain.handle("xorg_askWindowToClose", function(event, data) {
    return xorg.askWindowToClose(data.id);
});

ipcMain.handle("xorg_sendWindowInputEvent", function(event, data) {
    return xorg.sendWindowInputEvent(data.id, data.eventType, data.eventData);
});

ipcMain.handle("xorg_forceWindowToRepaint", function(event, data) {
    return xorg.forceWindowToRepaint(data.id);
});

ipcMain.handle("dev_isDebugBuild", function(event, data) {
    return Promise.resolve(main.IS_DEBUG_BUILD);
});

ipcMain.handle("dev_restart", function(event, data) {
    system.devRestart();

    return Promise.resolve();
});