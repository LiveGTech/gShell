/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as l10n from "gshell://config/l10n.js";
import * as displays from "gshell://system/displays.js";
import * as switcher from "gshell://userenv/switcher.js";
import * as linux from "gshell://integrations/linux.js";

const KEYBOARD_KEY_MAPPINGS = { // Mapping `KeyboardEvent.key` to an XCB keycode (use `xev` to find new keycodes)
    "Enter": 36,
    "Escape": 9,
    "Control": 37,
    "Alt": 64,
    "Shift": 50
};

const MOUSE_BUTTON_MAPPINGS = { // Mapping `MouseEvent.button` to an Xorg mouse button ID
    0: 1, // Main (typically left)
    1: 2, // Auxiliary (typically middle)
    2: 3, // Secondary (typically right)
    3: 8, // Button 4 (typically back)
    4: 9 // Button 5 (typically forward)
};

const DELAY_BEFORE_OVERLAY_CAN_CLOSE_ON_BLUR = 250; // 250 milliseconds
const DELAY_BEFORE_OVERLAY_KEYS_SENT = 250; // 250 milliseconds
const DURATION_NEW_OVERLAYS_CONSIDERED_CONTEXT_MENUS = 250; // 250 milliseconds

var currentMouseButton = null;
var lastOverlayShownAt = null;
var lastSecondaryClickAt = null;
var lastSecondaryClickX = null;
var lastSecondaryClickY = null;

export var trackedWindows = {};

function ensureWindowSize(trackedWindow) {
    if (!trackedWindow.screenElement) {
        return;
    }

    var windowContentsRect = trackedWindow.screenElement.find(".switcher_apps").get().getBoundingClientRect();
    
    if (trackedWindow.width == null || trackedWindow.height == null) {
        return;
    }

    if (windowContentsRect.width == trackedWindow.width && windowContentsRect.height == trackedWindow.height) {
        return;
    }

    var currentWindowContentsGeometry = switcher.getWindowContentsGeometry(trackedWindow.screenElement, true);

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
    if (trackedWindow.isOverlay) {
        return;
    }

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

function checkWindowProperties(trackedWindow) {
    if (trackedWindow.isOverlay) {
        return;
    }

    var titleUsed = null;

    gShell.call("xorg_getWindowProperties", {id: trackedWindow.id}).then(function(data) {
        if (trackedWindow.appElement) {
            if (data.title?.trim().length > 0) {
                titleUsed = data.title;
            }

            switcher.setAppCustomTab(trackedWindow.appElement, titleUsed);
        }

        if (data.pid == null) {
            // `_NET_WM_PID` not set yet

            requestAnimationFrame(function() {
                checkWindowProperties(trackedWindow);
            });

            return Promise.resolve();
        }

        return gShell.call("system_getProcessInfo", {pid: data.pid});
    }).then(function(data) {
        if (data == null) {
            return Promise.resolve();
        }

        var processName = linux.resolveProcessName(data.name);

        return gShell.call("linux_getAppInfo", {processName}).then(function(appDetails) {
            if (trackedWindow.appElement && appDetails != null) {
                var title = titleUsed;
                var currentLocale = l10n.currentLocale.localeCode;
    
                title ||= appDetails.localisedNames[currentLocale.split("_")[0]];
                title ||= appDetails.localisedNames[currentLocale];
                title ||= appDetails.name;
    
                switcher.setAppTitle(trackedWindow.appElement, title);
    
                if (appDetails.icon) {
                    switcher.setAppIcon(trackedWindow.appElement, URL.createObjectURL(
                        new Blob([appDetails.icon.data.buffer], {type: appDetails.icon.mimeType})
                    ), true);
                }
            }
        });
    });
}

export function init() {
    $g.sel("body").on("mouseup", function() {
        currentMouseButton = null;
    });

    $g.sel("body").on("click", function(event) {
        if (lastOverlayShownAt != null && Date.now() - lastOverlayShownAt < DELAY_BEFORE_OVERLAY_CAN_CLOSE_ON_BLUR) {
            return;
        }

        if ($g.sel(event.target).is(".xorg_overlay, .xorg_overlay *")) {
            return;
        }

        Object.values(trackedWindows).forEach(function(trackedWindow) {
            if (trackedWindow.isOverlay) {
                sendKeyToWindow(trackedWindow, "Escape");
            }
        });
    });

    gShell.on("xorg_trackWindow", function(event, data) {
        var canvas = $g.create("canvas");

        canvas.addClass("switcher_renderSurface");

        ["mousedown", "mouseup", "mousemove", "mouseenter", "mouseleave"].forEach(function(eventType) {
            canvas.on(eventType, function(event) {
                var canvasRect = canvas.get().getBoundingClientRect();

                updateXorgWindowPosition(trackedWindow);

                if (eventType == "mousedown") {
                    currentMouseButton = event.button;

                    if (currentMouseButton == 2) {
                        // Workaround to correctly position GTK context menus on display scale factors other than `1`
                        lastSecondaryClickAt = Date.now();
                        lastSecondaryClickX = event.clientX;
                        lastSecondaryClickY = event.clientY;
                    } else if (currentMouseButton != 0) {
                        lastSecondaryClickAt = null;
                    }

                    gShell.call("xorg_sendWindowInputEvent", {
                        id: data.id,
                        eventType: "focuswindow"
                    });
                }

                trackedWindow.lastX = event.clientX - canvasRect.x;
                trackedWindow.lastY = event.clientY - canvasRect.y;
                trackedWindow.lastAbsoluteX = event.clientX;
                trackedWindow.lastAbsoluteY = event.clientY;

                var promiseChain = Promise.resolve();

                function checkEventModifierKey(key, condition, eventOrder = ["keydown"]) {
                    if (eventType == "mousedown" && condition) {
                        promiseChain = promiseChain.then(function() {
                            return sendKeyToWindow(trackedWindow, key, eventOrder);
                        });
                    }
                }

                checkEventModifierKey("Control", event.ctrlKey);
                checkEventModifierKey("Alt", event.altKey);
                checkEventModifierKey("Shift", event.shiftKey);

                (eventType == "mouseup" ? [eventType, "mouseenter"] : [eventType]).forEach(function(eventType) {
                    promiseChain = promiseChain.then(function() {
                        return gShell.call("xorg_sendWindowInputEvent", {
                            id: data.id,
                            eventType,
                            eventData: {
                                x: trackedWindow.lastX,
                                y: trackedWindow.lastY,
                                absoluteX: trackedWindow.lastAbsoluteX,
                                absoluteY: trackedWindow.lastAbsoluteY,
                                button: MOUSE_BUTTON_MAPPINGS[currentMouseButton],
                                ctrlKey: event.ctrlKey,
                                altKey: event.altKey,
                                shiftKey: event.shiftKey
                            }
                        });
                    });
                });
                
                if (trackedWindow.isOverlay && Date.now() - trackedWindow.createdAt >= DELAY_BEFORE_OVERLAY_KEYS_SENT && eventType == "mouseup") {
                    // Workaround to activate GTK menu buttons; delayed to prevent activation when menu is positioned on top of opener

                    promiseChain = promiseChain.then(function() {
                        return sendKeyToWindow(trackedWindow, "Enter");
                    });
                }

                checkEventModifierKey("Control", event.ctrlKey, ["keyup"]);
                checkEventModifierKey("Alt", event.altKey, ["keyup"]);
                checkEventModifierKey("Shift", event.shiftKey, ["keyup"]);

                event.preventDefault();
            });
        });

        var surfaceContainer = $g.create("div")
            .addClass("xorg_surface")
            .add(canvas)
        ;

        var details = {
            displayName: _("unknown"),
            instantLaunch: true
        };

        var trackedWindow = {
            id: data.id,
            createdAt: Date.now(),
            isOverlay: data.isOverlay,
            surfaceContainer,
            width: null,
            height: null,
            initiallyPainted: false,
            initiallyResized: false,
            processingResize: false,
            overlayInitiallyPositioned: false,
            lastX: null,
            lastY: null,
            lastAbsoluteX: null,
            lastAbsoluteY: null
        };

        trackedWindows[data.id] = trackedWindow;

        trackedWindow.firstPaintCallback = function() {
            if (trackedWindow.isOverlay) {
                trackedWindow.overlayElement = $g.create("div")
                    .addClass("switcher_overlay")
                    .addClass("xorg_overlay")
                    .addClass("unpainted")
                    .setAttribute("hidden", true)
                    .add(surfaceContainer)
                ;
    
                $g.sel(".switcher_overlays").add(trackedWindow.overlayElement);
    
                switcher.showOverlay(trackedWindow.overlayElement);
    
                lastOverlayShownAt = Date.now();
            } else {
                switcher.openWindow(surfaceContainer, details, function(screenElement, appElement) {
                    trackedWindows[data.id].screenElement = screenElement;
                    trackedWindows[data.id].appElement = appElement;
        
                    appElement.addClass("switcher_indirectClose");
                    screenElement.addClass("switcher_indirectResize");
                    screenElement.addClass("switcher_overrideConstraints");
        
                    var lastEventX = null;
                    var lastEventY = null;
                    var lastEventWidth = null;
                    var lastEventHeight = null;
        
                    appElement.on("switcherclose", function(event) {
                        gShell.call("xorg_askWindowToClose", {id: data.id});
                    });
        
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
            }
    
            ensureWindowSize(trackedWindow);
            updateXorgWindowPosition(trackedWindow);
            checkWindowProperties(trackedWindow);
        };

        if (trackedWindow.isOverlay) {
            trackedWindow.firstPaintCallback();

            trackedWindow.firstPaintCallback = null;
        }
    });

    gShell.on("xorg_releaseWindow", function(event, data) {
        var trackedWindow = trackedWindows[data.id];

        if (!trackedWindow) {
            return;
        }

        if (trackedWindow.appElement) {
            switcher.closeApp(trackedWindow.appElement, true);
        }

        if (trackedWindow.overlayElement) {
            switcher.hideOverlay(trackedWindow.overlayElement).then(function() {
                trackedWindow.overlayElement.remove();
            });
        }

        trackedWindow = null;

        delete trackedWindows[data.id];
    });

    gShell.on("xorg_moveWindow", function(event, data) {
        var trackedWindow = trackedWindows[data.id];

        if (!trackedWindow || !trackedWindow.overlayElement) {
            return;
        }

        trackedWindow.overlayElement.applyStyle({
            "left": `${data.x}px`,
            "top": `${data.y}px`
        });
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

        if (trackedWindow.overlayElement && !trackedWindow.overlayInitiallyPositioned) {
            if (lastSecondaryClickAt != null && Date.now() - lastSecondaryClickAt <= DURATION_NEW_OVERLAYS_CONSIDERED_CONTEXT_MENUS) {
                trackedWindow.overlayElement.applyStyle({
                    "left": `${lastSecondaryClickX}px`,
                    "top": `${lastSecondaryClickY}px`
                });
            } else {
                trackedWindow.overlayElement.applyStyle({
                    "left": `${data.geometry.x}px`,
                    "top": `${data.geometry.y}px`
                });
            }

            requestAnimationFrame(function() {
                displays.fitElementInsideDisplay(trackedWindow.overlayElement);
            });

            trackedWindow.overlayInitiallyPositioned = true;
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

            sourceIndex++;
            destinationIndex += 4;
        }

        context.putImageData(destination, 0, 0);

        if (!trackedWindow.initiallyPainted) {
            gShell.call("xorg_forceWindowToRepaint", {id: data.id});
        }

        trackedWindow.initiallyPainted = true;
        trackedWindow.processingResize = false;

        if (trackedWindow.isOverlay) {
            trackedWindow.overlayElement.removeClass("unpainted");
        }

        if (data.image.width != trackedWindow.width || data.image.height != trackedWindow.height) {
            gShell.call("xorg_resizeWindow", {
                id: data.id,
                width: trackedWindow.width,
                height: trackedWindow.height
            });
        }
        
        if (data.image.width > 1 && data.image.height > 1 && trackedWindow.firstPaintCallback != null) {
            trackedWindow.firstPaintCallback();

            trackedWindow.firstPaintCallback = null;
        }
    });
}

export function sendKeyToWindow(trackedWindow, key, eventOrder = ["keydown", "keyup"]) {
    var id = Object.keys(trackedWindows).find((id) => trackedWindows[id] == trackedWindow);

    if (id == null) {
        return Promise.reject("Window is no longer being tracked");
    }

    var promiseChain = Promise.resolve();

    eventOrder.forEach(function(eventType) {
        promiseChain = promiseChain.then(function() {
            return gShell.call("xorg_sendWindowInputEvent", {
                id,
                eventType,
                eventData: {
                    x: trackedWindow.lastX,
                    y: trackedWindow.lastY,
                    absoluteX: trackedWindow.lastAbsoluteX,
                    absoluteY: trackedWindow.lastAbsoluteY,
                    keyCode: KEYBOARD_KEY_MAPPINGS[key]
                }
            });
        });
    });

    return promiseChain;
}