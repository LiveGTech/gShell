/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const child_process = require("child_process");

var flags = require("./flags");

exports.getScreenResolution = function() {
    if (!flags.isRealHardware()) {
        return Promise.resolve({width: 360, height: 720});
    }

    return new Promise(function(resolve, reject) {
        child_process.exec("xdpyinfo", function(error, stdout, stderr) {
            if (error) {
                reject(stderr);

                return;
            }

            resolve(stdout);
        });
    }).then(function(stdout) {
        var matches = stdout.match(/^\s*dimensions:\s+([0-9]+)x([0-9]+) pixels/m);

        return Promise.resolve({width: Number(matches[1]), height: Number(matches[2])});
    });
}