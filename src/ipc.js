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
var config = require("./config");

var ipcMain = electron.ipcMain;

ipcMain.handle("system_getFlags", function(event, data) {
    return system.getFlags();
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

ipcMain.handle("power_sleep", function(event, data) {
    system.sleep();

    return Promise.resolve();
});

ipcMain.handle("power_getState", function(event, data) {
    return system.getPowerState();
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

ipcMain.handle("webview_attach", function(event, data) {
    var webContents = electron.webContents.fromId(data.webContentsId);

    if (flags.isRealHardware) {
        webContents.setZoomFactor(5);
    }

    webContents.debugger.attach();

    return webContents.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: 0,
        height: 0,
        mobile: true
    });
});

ipcMain.handle("dev_restart", function(event, data) {
    system.devRestart();

    return Promise.resolve();
});