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
    var canvasElement = trackedWindow.surfaceContainer.find("canvas").get();
    var windowContentsRect = trackedWindow.screenElement.find(".switcher_apps").get().getBoundingClientRect();
    
    if (windowContentsRect.width == canvasElement.width && windowContentsRect.height == canvasElement.height) {
        return;
    }

    var currentWindowContentsGeometry = switcher.getWindowContentsGeometry(trackedWindow.screenElement, true);

    switcher.setWindowContentsGeometry(trackedWindow.screenElement, {
        x: currentWindowContentsGeometry.x,
        y: currentWindowContentsGeometry.y,
        width: canvasElement.width,
        height: canvasElement.height
    }, true);

    requestAnimationFrame(function() {
        ensureWindowSize(trackedWindow);
    });
}

export function init() {
    gShell.on("xorg_trackWindow", function(event, data) {
        var surfaceContainer = $g.create("div").add(
            $g.create("canvas")
        );

        var details = {
            displayName: "Xorg window",
            instantLaunch: true
        };

        var trackedWindow = {
            surfaceContainer,
            lastWidth: null,
            lastHeight: null,
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

                gShell.call("xorg_resizeWindow", {
                    id: data.id,
                    width: event.detail.geometry.width - offsets.windowWidth,
                    height: event.detail.geometry.height - offsets.windowHeight
                });

                lastEventWidth = event.detail.geometry.width;
                lastEventHeight = event.detail.geometry.height;

                trackedWindow.processingResize = true;
            });
        });
    });

    gShell.on("xorg_releaseWindow", function(event, data) {
        var trackedWindow = trackedWindows[data.id];

        if (trackedWindow.appElement) {
            switcher.closeApp(trackedWindow.appElement);
        }

        trackedWindow = null;
    });

    gShell.on("xorg_repaintWindow", function(event, data) {
        var trackedWindow = trackedWindows[data.id];

        if (!trackedWindow) {
            return;
        }

        var canvasElement = trackedWindow.surfaceContainer.find("canvas").get();

        canvasElement.width = data.image.width;
        canvasElement.height = data.image.height;

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

        trackedWindow.lastWidth = data.image.width;
        trackedWindow.lastHeight = data.image.height;

        ensureWindowSize(trackedWindow);

        // FIXME: Xorg still crashes due to too many resize requests
        // We could compare widths and heights against requested resize to ensure that resize has been processed
        trackedWindow.processingResize = false;
    });
}