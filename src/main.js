#!/usr/bin/env node

/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const minimist = require("minimist");
const electron = require("electron");

var argv = minimist(process.argv.slice(2));

console.log(argv);

electron.app.on("ready", function() {
    var window = new electron.BrowserWindow({
        width: 360,
        height: 720,
        fullscreen: !!argv["real"]
    });

    window.setMenuBarVisibility(false);

    window.loadFile("shell/index.html");
});