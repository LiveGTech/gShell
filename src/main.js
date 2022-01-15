#!/usr/bin/env node

/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

var flags = require("./flags");
var system = require("./system");

electron.app.on("ready", function() {
    system.getScreenResolution().then(function(resolution) {
        var window = new electron.BrowserWindow({
            width: resolution.width,
            height: resolution.height,
            fullscreen: flags.isRealHardware()
        });
    
        window.setMenuBarVisibility(false);

        if (flags.isRealHardware()) {
            window.setPosition(0, 0);
        }
    
        window.loadFile("shell/index.html");
    
        getScreenResolution().then(function(data) {
            console.log(data);
        }).catch(function(stderr) {
            console.log(stderr);
        });
    });
});