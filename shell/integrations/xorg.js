/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as switcher from "gshell://userenv/switcher.js";

export var trackedWindows = {};

function ensureWindowSize(trackedWindow) {
    var windowContentsRect = trackedWindow.screenElement.find(".switcher_apps").get().getBoundingClientRect();
    
    if (trackedWindow.width == null || trackedWindow.height == null) {
        return;
    }

    if (windowContentsRect.width == trackedWindow.width && windowContentsRect.height == trackedWindow.height) {
        return;
    }

    var currentWindowContentsGeometry = switcher.getWindowContentsGeometry(trackedWindow.screenElement, true);

    // TODO: Override minimum size constraint for small Xorg apps (as in geometry, like xeyes)
    switcher.setWindowContentsGeometry(trackedWindow.screenElement, {
        x: currentWindowContentsGeometry.x,
        y: currentWindowContentsGeometry.y,
        width: trackedWindow.width,
        height: trackedWindow.height
    }, true);

    requestAnimationFrame(function() {
        ensureWindowSize(trackedWindow);
    });
}

function updateXorgWindowPosition(trackedWindow) {
    var canvasRect = trackedWindow.surfaceContainer.find("canvas").get().getBoundingClientRect();

    if (canvasRect.x == trackedWindow.x && canvasRect.y == trackedWindow.y) {
        return;
    }

    trackedWindow.x = canvasRect.x;
    trackedWindow.y = canvasRect.y;

    gShell.call("xorg_moveWindow", {
        id: trackedWindow.id,
        x: trackedWindow.x,
        y: trackedWindow.y
    });
}

export function init() {
    gShell.on("xorg_trackWindow", function(event, data) {
        var canvas = $g.create("canvas");

        canvas.addClass("switcher_renderSurface");

        ["mousedown", "mouseup", "mousemove"].forEach(function(eventType) {
            canvas.on(eventType, function(event) {
                var canvasRect = canvas.get().getBoundingClientRect();

                updateXorgWindowPosition(trackedWindow);

                if (eventType == "mousedown" || eventType == "mouseup") {
                    gShell.call("xorg_sendWindowInputEvent", {
                        id: data.id,
                        eventType: "focuswindow"
                    });
                }
    
                gShell.call("xorg_sendWindowInputEvent", {
                    id: data.id,
                    eventType,
                    eventData: {
                        x: event.clientX - canvasRect.x,
                        y: event.clientY - canvasRect.y,
                        absoluteX: event.clientX,
                        absoluteY: event.clientY
                    }
                });

                event.preventDefault();
            });
        });

        var surfaceContainer = $g.create("div").add(canvas);

        var details = {
            displayName: "Xorg window",
            instantLaunch: true
        };

        var trackedWindow = {
            id: data.id,
            surfaceContainer,
            width: null,
            height: null,
            initiallyResized: false,
            processingResize: false
        };

        trackedWindows[data.id] = trackedWindow;

        switcher.openWindow(surfaceContainer, details, function(screenElement, appElement) {
            trackedWindows[data.id].screenElement = screenElement;
            trackedWindows[data.id].appElement = appElement;

            screenElement.addClass("switcher_indirectResize");

            var lastEventX = null;
            var lastEventY = null;
            var lastEventWidth = null;
            var lastEventHeight = null;

            screenElement.on("switchermove", function(event) {
                if (lastEventX == event.detail.geometry.x && lastEventY == event.detail.geometry.y) {
                    return;
                }

                var offsets = switcher.getWindowContentsOffsets(screenElement, true);

                trackedWindow.x = event.detail.geometry.x + offsets.contentsX;
                trackedWindow.y = event.detail.geometry.y + offsets.contentsY;

                gShell.call("xorg_moveWindow", {
                    id: data.id,
                    x: trackedWindow.x,
                    y: trackedWindow.y
                });

                lastEventX = event.detail.geometry.x;
                lastEventY = event.detail.geometry.y;
            });

            screenElement.on("switcherresize", function(event) {
                if (lastEventWidth == event.detail.geometry.width && lastEventHeight == event.detail.geometry.height) {
                    return;
                }

                if (trackedWindow.processingResize) {
                    return;
                }
                
                var offsets = switcher.getWindowContentsOffsets(screenElement);

                trackedWindow.width = event.detail.geometry.width - offsets.windowWidth;
                trackedWindow.height = event.detail.geometry.height - offsets.windowHeight;

                gShell.call("xorg_resizeWindow", {
                    id: data.id,
                    width: trackedWindow.width,
                    height: trackedWindow.height
                });

                if (!event.detail.maximising) {
                    ensureWindowSize(trackedWindow);
                }

                lastEventWidth = event.detail.geometry.width;
                lastEventHeight = event.detail.geometry.height;

                trackedWindow.processingResize = true;
            });
        });

        ensureWindowSize(trackedWindow);
        updateXorgWindowPosition(trackedWindow);
    });

    gShell.on("xorg_releaseWindow", function(event, data) {
        var trackedWindow = trackedWindows[data.id];

        if (trackedWindow.appElement) {
            switcher.closeApp(trackedWindow.appElement);
        }

        trackedWindow = null;
    });

    gShell.on("xorg_resizeWindow", function(event, data) {
        var trackedWindow = trackedWindows[data.id];

        if (!trackedWindow) {
            return;
        }

        trackedWindow.width = data.width;
        trackedWindow.height = data.height;
        trackedWindow.initiallyResized = true;

        ensureWindowSize(trackedWindow);
    });

    gShell.on("xorg_repaintWindow", function(event, data) {
        var trackedWindow = trackedWindows[data.id];

        if (!trackedWindow) {
            return;
        }

        updateXorgWindowPosition(trackedWindow);

        if (data.justResized) {
            trackedWindow.processingResize = false;

            return;
        }

        if (!trackedWindow.initiallyResized) {
            trackedWindow.width = data.image.width;
            trackedWindow.height = data.image.height;
            trackedWindow.initiallyResized = true;

            ensureWindowSize(trackedWindow);
        }

        var canvasElement = trackedWindow.surfaceContainer.find("canvas").get();

        canvasElement.width = trackedWindow.width;
        canvasElement.height = trackedWindow.height;

        var context = canvasElement.getContext("2d");
        var source = data.image.data;
        var destination = context.createImageData(data.image.width, data.image.height);

        var sourceIndex = 0;
        var destinationIndex = 0;

        for (var i = 0; i < data.image.width * data.image.height; i++) {
            destination.data[destinationIndex + 2] = source[sourceIndex++]; // Blue
            destination.data[destinationIndex + 1] = source[sourceIndex++]; // Green
            destination.data[destinationIndex + 0] = source[sourceIndex++]; // Red
            destination.data[destinationIndex + 3] = 255; // Alpha

            sourceIndex++; // TODO: Figure out what fourth channel value is meant to represent

            destinationIndex += 4;
        }

        context.putImageData(destination, 0, 0);

        trackedWindow.processingResize = false;
    });
}