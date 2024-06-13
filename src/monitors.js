/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var flags = require("./flags");
var system = require("./system");

exports.get = function() {
    if (!flags.isRealHardware && !flags.useHostMonitorLayout) {
        if (flags.simulateDualMonitorLayout) {
            return Promise.resolve({
                workArea: {
                    width: 1920,
                    height: 800,
                    maxWidth: 32767,
                    maxHeight: 32767
            },
                monitors: [
                    {
                        id: "HDMI-0",
                        isConnected: true,
                        isConfigured: true,
                        x: 0,
                        y: 0,
                        width: 960,
                        height: 800,
                        modes: [
                            {
                                id: "960x800",
                                width: 960,
                                height: 800,
                                isActive: true,
                                isPreferred: true,
                                frequencies: [
                                    {frequency: 60, isActive: true, isPreferred: true},
                                    {frequency: 50, isActive: false, isPreferred: false}
                                ]
                            }
                        ]
                    },
                    {
                        id: "HDMI-1",
                        isConnected: true,
                        isConfigured: true,
                        x: 960,
                        y: 0,
                        width: 960,
                        height: 800,
                        modes: [
                            {
                                id: "960x800",
                                width: 960,
                                height: 800,
                                isActive: true,
                                isPreferred: true,
                                frequencies: [
                                    {frequency: 60, isActive: true, isPreferred: true},
                                    {frequency: 50, isActive: false, isPreferred: false}
                                ]
                            }
                        ]
                    }
                ]
            });
        }

        return Promise.resolve({
            workArea: {
                width: 1280,
                height: 800,
                maxWidth: 32767,
                maxHeight: 32767
        },
            monitors: [
                {
                    id: "HDMI-0",
                    isConnected: true,
                    isConfigured: true,
                    x: 0,
                    y: 0,
                    width: 1280,
                    height: 800,
                    modes: [
                        {
                            id: "1280x800",
                            width: 1280,
                            height: 800,
                            isActive: true,
                            isPreferred: true,
                            frequencies: [
                                {frequency: 60, isActive: true, isPreferred: true},
                                {frequency: 50, isActive: false, isPreferred: false}
                            ]
                        }
                    ]
                }
            ]
        });
    }

    return system.executeCommand("xrandr", ["--query"]).then(function(output) {
        var lines = output.stdout.split("\n").filter((line) => line != "");
        var workArea = {width: 0, height: 0, maxWidth: Infinity, maxHeight: Infinity};
        var monitors = [];
        var currentMonitor = null;

        lines.forEach(function(line) {
            var parts = line.split(/\s+/).filter((part) => part != "");

            var workAreaMatch = line.match(/Screen 0: minimum \d+ x \d+, current (\d+) x (\d+), maximum (\d+) x (\d+)/);

            if (workAreaMatch) {
                workArea = {
                    width: parseInt(workAreaMatch[1]),
                    height: parseInt(workAreaMatch[2]),
                    maxWidth: parseInt(workAreaMatch[3]),
                    maxHeight: parseInt(workAreaMatch[4])
                };
            }

            if (["connected", "disconnected"].includes(parts[1])) {
                var position = parts.map((part) => part.match(/(\d+)x(\d+)([+-]\d+)([+-]\d+)/)).find((part) => part != null);

                currentMonitor = {
                    id: parts[0],
                    isConnected: parts[1] == "connected",
                    isPrimary: parts[2] == "primary",
                    isConfigured: false,
                    modes: []
                };

                if (position) {
                    currentMonitor.isConfigured = true;
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
                var isActive = false;
                var isPreferred = false;

                parts.slice(1).forEach(function(part) {
                    if (part == "+") {
                        currentFrequency.isPreferred = true;
                        isPreferred = true;

                        return;
                    }

                    currentFrequency = {
                        frequency: parseFloat(part.match(/^([0-9.]+)/)[1]),
                        isActive: false,
                        isPreferred: false
                    };

                    if (part.match(/\*\+?$/)) {
                        currentFrequency.isActive = true;
                        isActive = true;
                    }

                    if (part.match(/\+$/)) {
                        currentFrequency.isPreferred = true;
                        isPreferred = true;
                    }

                    frequencies.push(currentFrequency);
                });

                currentMonitor.modes.push({
                    id: parts[0],
                    width: parseInt(resolution[1]),
                    height: parseInt(resolution[2]),
                    isActive,
                    isPreferred,
                    frequencies
                });
            }
        });

        return Promise.resolve({workArea, monitors});
    });
};

exports.set = function(monitors) {
    return system.executeOrLogCommand("xrandr", monitors.map((monitor) => (
        monitor.isEnabled ?
        [
            "--output", monitor.id,
            "--mode", monitor.modeId,
            "--pos", `${monitor.x}x${monitor.y}`,
            ...(monitor.isPrimary ? ["--primary"] : []),
            "--transform", (monitor.transformationMatrix || [
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ]).join(",")
        ] :
        [
            "--output", monitor.id,
            "--off"
        ]
    )).flat());
};