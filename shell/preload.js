/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

electron.contextBridge.exposeInMainWorld("gshell", {
    call: function(command, data) {
        return electron.ipcRenderer.send(command, data);
    }
});