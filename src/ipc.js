/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

var main = require("./main");
var system = require("./system");

var ipcMain = electron.ipcMain;

ipcMain.handle("system_getFlags", function(event, data) {
    return system.getFlags();
});

ipcMain.handle("shell_setColourScheme", function(event, data) {
    return system.setColourScheme(data.scheme);
});

ipcMain.handle("power_shutDown", function(event, data) {
    system.shutDown();

    return Promise.resolve();
});

ipcMain.handle("power_getState", function(event, data) {
    return system.getPowerState();
});

ipcMain.handle("dev_restart", function(event, data) {
    system.devRestart();

    return Promise.resolve();
});