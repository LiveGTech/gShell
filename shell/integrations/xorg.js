/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as switcher from "gshell://userenv/switcher.js";

export var trackedWindows = {};

export function init() {
    gShell.on("xorg_trackWindow", function(event, data) {
        var surfaceContainer = $g.create("div").add(
            $g.create("canvas")
        );

        var details = {
            displayName: "Xorg window",
            instantLaunch: true
        };
        
        trackedWindows[data.id] = {surfaceContainer};

        switcher.openWindow(surfaceContainer, details, function(screenElement, appElement) {
            trackedWindows[data.id].appElement = appElement;
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

        for (var y = 0; y < data.image.height; y++) {
            for (var x = 0; x < data.image.width; x++) {
                destination.data[destinationIndex + 2] = source[sourceIndex++]; // Blue
                destination.data[destinationIndex + 1] = source[sourceIndex++]; // Green
                destination.data[destinationIndex + 0] = source[sourceIndex++]; // Red
                destination.data[destinationIndex + 3] = 255; // Alpha

                sourceIndex++; // TODO: Figure out what fourth channel value is meant to represent

                destinationIndex += 4;
            }
        }

        context.putImageData(destination, 0, 0);
    });
}