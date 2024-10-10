/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as device from "gshell://system/device.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

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
    "wait": {
        originX: 10,
        originY: 10
    },
    "cell": {
        originX: 7,
        originY: 7
    },
    "crosshair": {
        originX: 9,
        originY: 9
    },
    "text": {
        originX: 4,
        originY: 10
    },
    "vertical-text": {
        originX: 10,
        originY: 4
    },
    "copy": {
        originX: 0,
        originY: 0
    },
    "move": {
        originX: 10,
        originY: 10
    },
    "alias": {
        originX: 0,
        originY: 0
    },
    "ew-resize": {
        originX: 10,
        originY: 3
    },
    "ns-resize": {
        originX: 3,
        originY: 10
    },
    "nesw-resize": {
        originX: 7,
        originY: 7
    },
    "nwse-resize": {
        originX: 7,
        originY: 7
    }
};

export const CURSOR_TYPE_ALIASES = {
    "n-resize": "ns-resize",
    "e-resize": "ew-resize",
    "s-resize": "ns-resize",
    "w-resize": "ew-resize",
    "ne-resize": "nesw-resize",
    "nw-resize": "nwse-resize",
    "se-resize": "nwse-resize",
    "sw-resize": "nesw-resize"
};

export var x = 0;
export var y = 0;
export var currentType = null;
export var mouseShouldShow = false;
export var mouseIsShowing = false;

export function setType(type) {
    type = CURSOR_TYPE_ALIASES[type] || type;

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

            if (mouseIsShowing != mouseShouldShow) {
                if (mouseShouldShow) {
                    $g.sel("#cursor").fadeIn();
                } else {
                    $g.sel("#cursor").fadeOut();
                }

                mouseIsShowing = mouseShouldShow;
            }

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

        mouseShouldShow = event.pointerType == "mouse";
    });

    webviewComms.onEvent("pointermove", (event) => mouseShouldShow = event.pointerType == "mouse");

    if (device.data?.type != "desktop") {
        $g.sel("#cursor").hide();
    }
}