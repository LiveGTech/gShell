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

export function init() {
    gShell.on("xorg_trackWindow", function(event, data) {
        var surfaceContainer = $g.create("div").add(
            $g.create("canvas")
                .addClass("switcher_renderSurface")
        );

        var details = {
            displayName: "Xorg window",
            instantLaunch: true
        };

        // TODO: Get initial width and height
        var trackedWindow = {
            surfaceContainer,
            width: 200,
            height: 200,
            initiallyResized: false,
            processingResize: false
        };

        trackedWindows[data.id] = trackedWindow;

        switcher.openWindow(surfaceContainer, details, function(screenElement, appElement) {
            trackedWindows[data.id].screenElement = screenElement;
            trackedWindows[data.id].appElement = appElement;

            screenElement.addClass("switcher_indirectResize");

            var lastEventWidth = null;
            var lastEventHeight = null;

            screenElement.on("switcherresize", function resizeEventHandler(event) {
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

                ensureWindowSize(trackedWindow);

                lastEventWidth = event.detail.geometry.width;
                lastEventHeight = event.detail.geometry.height;

                trackedWindow.processingResize = true;
            });
        });

        ensureWindowSize(trackedWindow);
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

        if (data.justResized) {
            trackedWindow.processingResize = false;

            return;
        }

        if (!trackedWindow.initiallyResized) {
            console.log("fixed resize");
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