/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

var system = require("./system");

var ipcMain = electron.ipcMain;

ipcMain.on("power_shutDown", function(event, data) {
    system.shutDown();
});