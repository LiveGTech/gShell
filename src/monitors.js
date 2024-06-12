/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var flags = require("./flags");
var system = require("./system");

exports.get = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve({
            monitors: [
                {
                    id: "HDMI-1",
                    connected: true,
                    modes: [
                        {
                            width: 1920,
                            height: 1080,
                            active: true,
                            frequencies: [
                                {frequency: 60, active: true},
                                {frequency: 50, active: false}
                            ]
                        }
                    ]
                }
            ]
        });
    }

    return system.executeCommand("xrandr", ["--query"]).then(function(output) {
        var lines = output.stdout.split("\n").filter((line) => line != "");
        var monitors = [];
        var currentMonitor = null;

        lines.forEach(function(line) {
            var parts = line.split(/\s+/).filter((part) => part != "");

            if (["connected", "disconnected"].includes(parts[1])) {
                currentMonitor = {
                    id: parts[0],
                    connected: parts[1] == "connected",
                    modes: []
                };

                monitors.push(currentMonitor);

                return;
            }

            if (currentMonitor == null) {
                return;
            }

            var resolution = parts[0].match(/^(\d+)x(\d+)$/);

            if (resolution) {
                currentMonitor.modes.push({
                    width: parseInt(resolution[1]),
                    height: parseInt(resolution[2]),
                    active: !!parts.slice(1).find((part) => part.match(/\*\+?$/)),
                    frequencies: parts.slice(1).filter((part) => part != "+").map((part) => ({
                        frequency: parseFloat(part.match(/^([0-9.]+)/)[1]),
                        active: !!part.match(/\*\+?$/)
                    }))
                });
            }
        });

        return Promise.resolve({monitors});
    });
};