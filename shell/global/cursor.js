/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as device from "gshell://system/device.js";

export const CURSOR_TYPES = {
    "default": {
        originX: 0,
        originY: 0
    },
    "none": {
        originX: 0,
        originY: 0
    },
    "context-menu": {
        originX: 0,
        originY: 0
    },
    "help": {
        originX: 0,
        originY: 0
    },
    "pointer": {
        originX: 6,
        originY: 0
    },
    "progress": {
        originX: 0,
        originY: 0
    },
    "text": {
        originX: 4,
        originY: 10
    }
};

export var x = 0;
export var y = 0;
export var currentType = null;

export function setType(type) {
    if (!CURSOR_TYPES[type]) {
        type = "default";
    }

    if (currentType == type) {
        return Promise.resolve();
    }

    currentType = type;

    return fetch(`gshell://media/cursors/${type}.svg`).then(function(response) {
        return response.text();
    }).then(function(html) {
        $g.sel("#cursor").setHTML(html);

        return Promise.resolve();
    });
}

export function init() {
    setType("default");

    function updateRendering() {
        var typeInfo = CURSOR_TYPES[currentType];

        $g.sel("#cursor").setStyle("transform", `translate(${x - (typeInfo.originX || 0)}px, ${y - (typeInfo.originY || 0)}px)`);
    }

    requestAnimationFrame(function updateAuthoritative() {
        gShell.call("io_getMouseCursorPosition").then(function(data) {
            x = data.x / device.data.display.scaleFactor;
            y = data.y / device.data.display.scaleFactor;

            updateRendering();

            requestAnimationFrame(updateAuthoritative);
        });
    });

    $g.sel("body").on("pointermove", function(event) {
        x = event.clientX;
        y = event.clientY;

        var currentElementCursor = getComputedStyle(event.target).cursor;

        if (currentElementCursor == "auto") {
            currentElementCursor = "default";
        }

        setType(currentElementCursor).catch(function(error) {
            console.warn(error);
        });
    });
}