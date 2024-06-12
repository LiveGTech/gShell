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
                            preferred: true,
                            frequencies: [
                                {frequency: 60, active: true, preferred: true},
                                {frequency: 50, active: false, preferred: false}
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
                var position = parts.map((part) => part.match(/(\d+)x(\d+)([+-]\d+)([+-]\d+)/)).find((part) => part != null);

                currentMonitor = {
                    id: parts[0],
                    connected: parts[1] == "connected",
                    configured: false,
                    modes: []
                };

                if (position) {
                    currentMonitor.configured = true;
                    currentMonitor.x = parseInt(position[3]);
                    currentMonitor.y = parseInt(position[4]);
                    currentMonitor.width = parseInt(position[1]);
                    currentMonitor.height = parseInt(position[2]);
                }

                monitors.push(currentMonitor);

                return;
            }

            if (currentMonitor == null) {
                return;
            }

            var resolution = parts[0].match(/^(\d+)x(\d+)$/);

            if (resolution) {
                var frequencies = [];
                var currentFrequency = null;
                var active = false;
                var preferred = false;

                parts.slice(1).forEach(function(part) {
                    if (part == "+") {
                        currentFrequency.preferred = true;
                        preferred = true;

                        return;
                    }

                    currentFrequency = {
                        frequency: parseFloat(part.match(/^([0-9.]+)/)[1]),
                        active: false,
                        preferred: false
                    };

                    if (part.match(/\*\+?$/)) {
                        currentFrequency.active = true;
                        active = true;
                    }

                    if (part.match(/\+$/)) {
                        currentFrequency.preferred = true;
                        preferred = true;
                    }

                    frequencies.push(currentFrequency);
                });

                currentMonitor.modes.push({
                    width: parseInt(resolution[1]),
                    height: parseInt(resolution[2]),
                    active,
                    preferred,
                    frequencies
                });
            }
        });

        return Promise.resolve({monitors});
    });
};