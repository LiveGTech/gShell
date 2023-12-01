/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const x11 = require("x11");

var main = require("./main");
var flags = require("./flags");

var display;
var root;
var X;
var Composite;
var Damage;
var Input;
var mainWindowId = null;
var trackedWindows = [];
var requestLock = false;
var configureRequestQueue = [];

function promisify(call, scope = this, ...args) {
    return new Promise(function(resolve, reject) {
        call.apply(scope, [...args, function(error, ...callbackArgs) {
            if (error) {
                reject(error);

                return;
            }

            resolve(...callbackArgs);
        }]);
    });
}

function trackWindow(windowId) {
    Composite.RedirectWindow(windowId, Composite.Redirect.Automatic);
    X.MapWindow(windowId);

    var pixmapId = X.AllocID();
    var damageId = X.AllocID();
    
    Composite.NameWindowPixmap(windowId, pixmapId);
    Damage.Create(damageId, windowId, Damage.ReportLevel.NonEmpty);

    trackedWindows.push({
        windowId,
        pixmapId,
        damageId,
        justResized: false
    });

    main.window.webContents.send("xorg_trackWindow", {id: trackedWindows.length - 1});

    var configureRequestIndex = configureRequestQueue.findIndex((event) => event.wid == windowId);

    if (configureRequestIndex >= 0) {
        var event = configureRequestQueue[configureRequestIndex];

        main.window.webContents.send("xorg_resizeWindow", {id: trackedWindows.length - 1, width: event.width, height: event.height});

        configureRequestQueue.splice(configureRequestIndex, 1);
    }
}

function findTrackedWindowIndexByWindowId(windowId) {
    return trackedWindows.findIndex((trackedWindow) => trackedWindow?.windowId == windowId);
}

function releaseWindow(windowId) {
    var id = findTrackedWindowIndexByWindowId(windowId);
    var trackedWindow = trackedWindows[id];

    if (!trackedWindow) {
        return;
    }

    trackedWindows[id] = null;

    main.window.webContents.send("xorg_releaseWindow", {id});
}

function getTrackedWindowById(id) {
    var trackedWindow = trackedWindows[id];

    if (!trackedWindow) {
        return Promise.reject("ID does not exist");
    }

    return Promise.resolve(trackedWindow);
}

function mustBeTracking(id, callback) {
    if (!trackedWindows[id]) {
        return Promise.reject("Window is no longer tracked");
    }

    return callback();
}

function waitForTurn() {
    if (!requestLock) {
        requestLock = true;

        return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
        setTimeout(function check() {
            if (!requestLock) {
                requestLock = true;

                resolve();

                return;
            }

            setTimeout(check);
        });
    });
}

function releaseTurn() {
    requestLock = false;

    return Promise.resolve(...arguments);
}

function releaseTurnAnyway() {
    requestLock = false;

    return Promise.reject(...arguments);
}

exports.getWindowSurfaceImage = function(id) {
    var trackedWindow;

    return waitForTurn().then(function() {
        return getTrackedWindowById(id);
    }).then(function(trackedWindowResult) {
        trackedWindow = trackedWindowResult;
    
        return mustBeTracking(id, () => promisify(X.GetGeometry, X, trackedWindow.pixmapId));
    }).then(function(geometry) {
        return mustBeTracking(id, () => promisify(X.GetImage, X, 2, trackedWindow.pixmapId, 0, 0, geometry.width, geometry.height, 0xFFFFFFFF)).then(function(data) {
            return Promise.resolve({
                ...data,
                width: geometry.width,
                height: geometry.height
            });
        }).then(releaseTurn).catch(releaseTurnAnyway);
    });
};

exports.moveWindow = function(id, x, y) {
    return waitForTurn().then(function() {
        return getTrackedWindowById(id);
    }).then(function(trackedWindow) {
        X.MoveWindow(trackedWindow.windowId, Math.floor(x), Math.floor(y));

        return Promise.resolve();
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.resizeWindow = function(id, width, height) {
    return waitForTurn().then(function() {
        return getTrackedWindowById(id);
    }).then(function(trackedWindow) {
        X.ResizeWindow(trackedWindow.windowId, Math.floor(width), Math.floor(height));

        var pixmapId = X.AllocID();

        Composite.NameWindowPixmap(trackedWindow.windowId, pixmapId);

        trackedWindow.pixmapId = pixmapId;
        trackedWindow.justResized = true;

        return Promise.resolve();
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.sendWindowInputEvent = function(id, eventType, eventData) {
    var trackedWindow;

    return waitForTurn().then(function() {
        return getTrackedWindowById(id);
    }).then(function(trackedWindowResult) {
        trackedWindow = trackedWindowResult;

        if (!["mousedown", "mouseup", "mousemove"].includes(eventType)) {
            return Promise.resolve(null);
        }

        return mustBeTracking(id, () => promisify(X.TranslateCoordinates, X, root, trackedWindow.windowId, eventData.absoluteX, eventData.absoluteY));
    }).then(function(translatedCoordinates) {
        var eventBuffer = Buffer.alloc(32);
        var offset = 0;

        switch (eventType) {
            case "mousedown":
            case "mouseup":
            case "mousemove":
                var state = 0;

                state |= x11.eventMask.EnterWindow;

                if (eventType == "mouseup") {
                    state |= x11.eventMask.Button1Motion; // TODO: Make this correspond to what button has been pressed
                }

                // `xcb_motion_notify_event_t`
                offset = eventBuffer.writeUInt8({
                    "mousedown": 4,
                    "mouseup": 5,
                    "mousemove": 6
                }[eventType], offset); // `response_type`: `MotionNotify`
                offset = eventBuffer.writeUInt8(1, offset); // `detail` TODO: Make this correspond to what button has been pressed
                offset = eventBuffer.writeUInt16LE(0, offset); // `sequence`
                offset = eventBuffer.writeUInt32LE(0, offset); // `time`
                offset = eventBuffer.writeUInt32LE(root, offset); // `root`
                offset = eventBuffer.writeUInt32LE(trackedWindow.windowId, offset); // `event`
                offset = eventBuffer.writeUInt32LE(translatedCoordinates.child, offset); // `child`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.absoluteX) || 0, offset); // `root_x`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.absoluteY) || 0, offset); // `root_y`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.x), offset); // `event_x`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.y), offset); // `event_y`
                offset = eventBuffer.writeUInt16LE(state, offset); // `state`
                offset = eventBuffer.writeUint8(translatedCoordinates.sameScreen, offset); // `same_screen`

                X.SendEvent(trackedWindow.windowId, true, {
                    "mousedown": x11.eventMask.ButtonPress,
                    "mouseup": x11.eventMask.ButtonRelease,
                    "mousemove": x11.eventMask.PointerMotion
                }[eventType], eventBuffer);

                return Promise.resolve();

            case "focuswindow":
                // Sending XInput `SetDeviceFocus`
                // FIXME: Getting error 129 (`BadDevice`) error at the moment

                // X.seq_num++;

                // `focus` (window ID), `time`, `revert_to`, `device_id` (which always seems to be `2`)
                // Reference: https://refspecs.linuxbase.org/Xorg/Xiproto.pdf
                // X.pack_stream.pack("CCSLLCCx", [Input.majorOpcode, 21, 4, trackedWindow.windowId, 0, 0, 2]); // TODO: Use a non-hardcoded device ID
                // X.pack_stream.flush();

                return Promise.resolve();

            default:
                return Promise.reject(`Unknown event type \`${eventType}\``)
        }
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.init = function() {
    if (!flags.allowXorgWindowManagement) {
        return Promise.resolve();
    }

    mainWindowId = main.window.getNativeWindowHandle().readUint32LE();

    return new Promise(function(resolve, reject) {
        x11.createClient(function(error, displayResult) {
            if (error) {
                reject(error);

                return;
            }

            display = displayResult;
            root = display.screen[0].root;
            X = display.client;

            X.on("error", function(error) {
                console.error(error);
            });

            resolve();
        }).on("event", function(event) {
            switch (event.name) {
                case "MapRequest":
                    trackWindow(event.wid);

                    break;

                case "ConfigureRequest":
                    var id = findTrackedWindowIndexByWindowId(event.window);
                    var trackedWindow = trackedWindows[id];

                    if (!trackedWindow) {
                        configureRequestQueue.push(event);

                        break;
                    }

                    main.window.webContents.send("xorg_resizeWindow", {id, width: event.width, height: event.height});

                    break;

                case "ResizeRequest":
                    var id = findTrackedWindowIndexByWindowId(event.window);
                    var trackedWindow = trackedWindows[id];

                    if (!trackedWindow) {
                        break;
                    }

                    main.window.webContents.send("xorg_resizeWindow", {id, width: event.width, height: event.height});

                    break;

                case "DamageNotify":
                    var id = findTrackedWindowIndexByWindowId(event.drawable);
                    var trackedWindow = trackedWindows[id];

                    if (!trackedWindow) {
                        break;
                    }

                    exports.getWindowSurfaceImage(id).then(function(image) {
                        main.window.webContents.send("xorg_repaintWindow", {id, image, justResized: trackedWindow.justResized});

                        if (trackedWindow.justResized) {
                            X.ClearArea(trackedWindow.windowId, 0, 0, image.width, image.height, true);

                            trackedWindow.justResized = false;
                        }

                        if (!trackedWindows[id]) {
                            // Don't subtract damage from a window that has since been released
                            return Promise.resolve();
                        }

                        Damage.Subtract(trackedWindow.damageId, 0, 0);
                    });

                    break;

                case "UnmapNotify":
                    releaseWindow(event.wid);
                    break;
            }
        });
    }).then(function() {
        return X.ChangeWindowAttributes(root, {eventMask: x11.eventMask.SubstructureNotify | x11.eventMask.SubstructureRedirect | x11.eventMask.ResizeRedirect});
    }).then(function() {
        return promisify(X.require, X, "composite");
    }).then(function(extension) {
        Composite = extension;

        return promisify(X.require, X, "damage");
    }).then(function(extension) {
        Damage = extension;

        return promisify(X.QueryExtension, X, "XInputExtension");
    }).then(function(inputExtension) {
        if (!inputExtension.present) {
            return Promise.reject("XInput extension not available");
        }

        Input = inputExtension;

        X.seq_num++;

        // `device_id`
        // Reference: https://refspecs.linuxbase.org/Xorg/Xiproto.pdf
        X.pack_stream.pack("CCSL", [Input.majorOpcode, 3, 2, 7]); // TODO: Use a non-hardcoded device ID
        X.pack_stream.flush();

        return promisify(Composite.GetOverlayWindow, X, root);
    }).then(function(overlayWindowId) {
        X.ReparentWindow(mainWindowId, overlayWindowId, 0, 0);

        return Promise.resolve();
    });
};