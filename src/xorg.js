/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const x11 = require("@liveg/x11");

var main = require("./main");
var flags = require("./flags");
var monitors = require("./monitors");

const REQUIRED_ATOMS = [
    "WM_PROTOCOLS",
    "WM_DELETE_WINDOW",
    "_NET_SUPPORTED",
    "_NET_ACTIVE_WINDOW",
    "_NET_WM_NAME",
    "_NET_WM_PID"
];

const SUPPORTED_ATOMS = [
    "_NET_ACTIVE_WINDOW"
];

const MAX_PROPERTY_LENGTH = 10_000;

// `xcb_key_but_mask_t`
const xcbKeyButtonMask = {
    SHIFT: 1,
    CONTROL: 4,
    BUTTON_1: 256,
    BUTTON_2: 512,
    BUTTON_3: 1024
};

var display;
var root;
var X;
var Composite;
var Damage;
var Randr;
var atoms = {};
var mainWindowId = null;
var mapRequestedWindowIds = [];
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

function trackWindow(windowId, isOverlay = false) {
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
        isOverlay,
        justResized: false
    });

    main.window.webContents.send("xorg_trackWindow", {id: trackedWindows.length - 1, isOverlay});

    while (true) {
        var configureRequestIndex = configureRequestQueue.findIndex((event) => event.wid == windowId);
    
        if (configureRequestIndex < 0) {
            break;
        }

        var event = configureRequestQueue[configureRequestIndex];

        main.window.webContents.send("xorg_moveWindow", {id: trackedWindows.length - 1, x: event.x, y: event.y});
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

function getProperty(id, atom, atomType = X.atoms.STRING) {
    return getTrackedWindowById(id).then(function(trackedWindow) {
        return promisify(X.GetProperty, X, 0, trackedWindow.windowId, atom, atomType, 0, MAX_PROPERTY_LENGTH);
    }).then(function(prop) {
        if (prop.type != atomType) {
            return Promise.resolve(null);
        }

        if (prop.type == X.atoms.STRING) {
            return Promise.resolve(String(prop.data));
        }
        
        return Promise.resolve(prop.data);
    });
}

exports.getWindowProperties = function(id) {
    var properties = {};

    var propertyPromises = {
        "WM_NAME": getProperty(id, X.atoms.WM_NAME),
        "_NET_WM_NAME": getProperty(id, atoms["_NET_WM_NAME"]),
        "_NET_WM_PID": getProperty(id, atoms["_NET_WM_PID"], X.atoms.CARDINAL)
    };

    return waitForTurn().then(function() {
        return Promise.all(Object.values(propertyPromises))
    }).then(function(propertiesPromiseReturns) {
        var propertyResults = {};

        Object.keys(propertyPromises).forEach(function(key, i) {
            propertyResults[key] = propertiesPromiseReturns[i];
        });

        properties.title = propertyResults["_NET_WM_NAME"] || propertyResults["WM_NAME"] || null;
        properties.pid = propertyResults["_NET_WM_PID"]?.readUInt32LE(0) ?? null;

        return Promise.resolve(properties);
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.getWindowGeometry = function(id) {
    return waitForTurn().then(function() {
        return getTrackedWindowById(id);
    }).then(function(trackedWindow) {    
        return mustBeTracking(id, () => promisify(X.GetGeometry, X, trackedWindow.pixmapId));
    }).then(function(geometry) {
        return Promise.resolve({
            x: geometry.xPos,
            y: geometry.yPos,
            width: geometry.width,
            height: geometry.height
        });
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.getCursorInfo = function() {
    return waitForTurn().then(function() {
        return promisify(X.QueryPointer, X, mainWindowId);
    }).then(function(data) {
        return Promise.resolve({
            x: data.rootX,
            y: data.rootY
        });
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.getWindowSurfaceImage = function(id) {
    // FIXME: Don't get surface images of `InputOnly` windows

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
                x: geometry.xPos,
                y: geometry.yPos,
                width: geometry.width,
                height: geometry.height
            });
        });
    }).then(releaseTurn).catch(releaseTurnAnyway);
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

exports.askWindowToClose = function(id) {
    return waitForTurn().then(function() {
        return getTrackedWindowById(id);
    }).then(function(trackedWindow) {
        var eventBuffer = Buffer.alloc(32);
        var offset = 0;

        // `xcb_client_message_event_t`
        offset = eventBuffer.writeUInt8(33, offset); // `ClientMessage`
        offset = eventBuffer.writeUInt8(32, offset); // `format`
        offset = eventBuffer.writeUInt16LE(0, offset); // `sequence`
        offset = eventBuffer.writeUInt32LE(trackedWindow.windowId, offset); // `window`
        offset = eventBuffer.writeUInt32LE(atoms["WM_PROTOCOLS"], offset); // `type`
        offset = eventBuffer.writeUInt32LE(atoms["WM_DELETE_WINDOW"], offset); // `data`

        X.SendEvent(trackedWindow.windowId, false, 0, eventBuffer);

        return Promise.resolve();
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.sendWindowInputEvent = function(id, eventType, eventData) {
    var trackedWindow;

    return waitForTurn().then(function() {
        return getTrackedWindowById(id);
    }).then(function(trackedWindowResult) {
        trackedWindow = trackedWindowResult;

        if (!["keydown", "keyup", "mousedown", "mouseup", "mousemove", "mouseenter", "mouseleave"].includes(eventType)) {
            return Promise.resolve(null);
        }

        return mustBeTracking(id, () => promisify(X.TranslateCoordinates, X, root, trackedWindow.windowId, eventData.absoluteX, eventData.absoluteY));
    }).then(function(translatedCoordinates) {
        var eventBuffer = Buffer.alloc(32);
        var offset = 0;

        switch (eventType) {
            case "keydown":
            case "keyup":
                // `xcb_key_press_event_t`/`xcb_key_release_event_t`
                offset = eventBuffer.writeUInt8({
                    "keydown": 2, // `response_type`: `KeyPress`
                    "keyup": 3, // `response_type`: `KeyRelease`
                }[eventType], offset);
                offset = eventBuffer.writeUInt8(eventData.keyCode, offset); // `detail`
                offset = eventBuffer.writeUInt16LE(0, offset); // `sequence`
                offset = eventBuffer.writeUInt32LE(0, offset); // `time`
                offset = eventBuffer.writeUInt32LE(root, offset); // `root`
                offset = eventBuffer.writeUInt32LE(trackedWindow.windowId, offset); // `event`
                offset = eventBuffer.writeUInt32LE(translatedCoordinates.child, offset); // `child`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.absoluteX) || 0, offset); // `root_x`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.absoluteY) || 0, offset); // `root_y`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.x), offset); // `event_x`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.y), offset); // `event_y`
                offset = eventBuffer.writeUInt16LE(0, offset); // `state`
                offset = eventBuffer.writeUint8(translatedCoordinates.sameScreen, offset); // `same_screen`

                X.SendEvent(trackedWindow.windowId, true, {
                    "keydown": x11.eventMask.KeyPress,
                    "keyup": x11.eventMask.KeyRelease
                }[eventType], eventBuffer);

                return Promise.resolve();

            case "mousedown":
            case "mouseup":
            case "mousemove":
                var state = 0;

                state |= x11.eventMask.EnterWindow;

                if (eventData.button != null) {
                    state |= {
                        1: xcbKeyButtonMask.BUTTON_1,
                        2: xcbKeyButtonMask.BUTTON_2,
                        3: xcbKeyButtonMask.BUTTON_3
                    }[eventData.button];
                }

                if (eventData.ctrlKey) {
                    state |= xcbKeyButtonMask.CONTROL;
                }

                if (eventData.shiftKey) {
                    state |= xcbKeyButtonMask.SHIFT;
                }

                // `xcb_button_press_event_t`/`xcb_button_release_event_t`/`xcb_motion_notify_event_t`
                offset = eventBuffer.writeUInt8({
                    "mousedown": 4, // `response_type`: `ButtonPress`
                    "mouseup": 5, // `response_type`: `ButtonRelease`
                    "mousemove": 6 // `response_type`: `MotionNotify`
                }[eventType], offset);
                offset = eventBuffer.writeUInt8(eventData.button || 0, offset); // `detail`
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

            case "mouseenter":
            case "mouseleave":
                eventBuffer = Buffer.alloc(32);

                // `xcb_enter_notify_event_t`/`xcb_leave_notify_event_t`
                offset = eventBuffer.writeUInt8({
                    "mouseenter": 7, // `response_type`: `EnterNotify`
                    "mouseleave": 8 // `response_type`: `LeaveNotify`
                }[eventType], offset);
                offset = eventBuffer.writeUInt8(0, offset); // `detail`
                offset = eventBuffer.writeUInt16LE(0, offset); // `sequence`
                offset = eventBuffer.writeUInt32LE(0, offset); // `time`
                offset = eventBuffer.writeUInt32LE(root, offset); // `root`
                offset = eventBuffer.writeUInt32LE(trackedWindow.windowId, offset); // `event`
                offset = eventBuffer.writeUInt32LE(translatedCoordinates.child, offset); // `child`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.absoluteX) || 0, offset); // `root_x`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.absoluteY) || 0, offset); // `root_y`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.x), offset); // `event_x`
                offset = eventBuffer.writeInt16LE(Math.floor(eventData.y), offset); // `event_y`
                offset = eventBuffer.writeUInt16LE(0, offset); // `state`
                offset = eventBuffer.writeUInt8(0, offset); // `mode`: `NotifyNormal`
                offset = eventBuffer.writeUInt8(translatedCoordinates.sameScreen, offset); // `same_screen`

                X.SendEvent(trackedWindow.windowId, true, {
                    "mouseenter": x11.eventMask.EnterWindow,
                    "mouseleave": x11.eventMask.LeaveWindow
                }[eventType], eventBuffer);

                return Promise.resolve();

            case "focuswindow":
                X.SetInputFocus(trackedWindow.windowId, 0, 0);

                var windowIdBuffer = Buffer.alloc(4);

                windowIdBuffer.writeUInt32LE(trackedWindow.windowId, 0);

                X.ChangeProperty(0, root, atoms["_NET_ACTIVE_WINDOW"], X.atoms.WINDOW, 32, windowIdBuffer);

                return Promise.resolve();

            default:
                return Promise.reject(`Unknown event type \`${eventType}\``);
        }
    }).then(releaseTurn).catch(releaseTurnAnyway);
};

exports.forceWindowToRepaint = function(id) {
    exports.getWindowSurfaceImage(id).then(function(image) {
        main.window.webContents.send("xorg_repaintWindow", {
            id,
            image,
            geometry: {
                x: image.x,
                y: image.y,
                width: image.width,
                height: image.height
            },
            justResized: false
        });

        return Promise.resolve();
    });
};

exports.init = function() {
    if (!flags.allowXorgWindowManagement) {
        return Promise.resolve();
    }

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
                    mapRequestedWindowIds.push(event.wid);
                    trackWindow(event.wid);

                    break;

                case "CreateNotify":
                    configureRequestQueue.push(event);
                    break;

                case "MapNotify":
                    if (mapRequestedWindowIds.includes(event.wid) || mainWindowId == null) {
                        break;
                    }

                    trackWindow(event.wid, true);

                    break;

                case "ConfigureRequest":
                    var id = findTrackedWindowIndexByWindowId(event.window);
                    var trackedWindow = trackedWindows[id];

                    if (!trackedWindow) {
                        configureRequestQueue.push(event);

                        break;
                    }

                    main.window.webContents.send("xorg_moveWindow", {id, x: event.x, y: event.y});
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
                        main.window.webContents.send("xorg_repaintWindow", {
                            id,
                            image,
                            geometry: {
                                x: event.geometry.x,
                                y: event.geometry.y,
                                width: event.geometry.w,
                                height: event.geometry.h
                            },
                            justResized: trackedWindow.justResized
                        });

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

                case "KeyPress":
                    if (event.keycode == 124) {
                        main.window.webContents.send("xorg_powerButtonDown");
                    }

                    break;

                case "KeyRelease":
                    if (event.keycode == 124) {
                        main.window.webContents.send("xorg_powerButtonUp");
                    }

                    break;

                case "RRScreenChangeNotify":
                    main.window.webContents.send("xorg_monitorChange");

                    if (flags.isRealHardware || flags.useHostMonitorLayout) {                        
                        monitors.get().then(function(monitorData) {
                            main.window.setPosition(0, 0);

                            main.window.setSize(
                                monitorData.workArea.width + 1,
                                monitorData.workArea.height + 1
                            );
                        });
                    }

                    break;
            }
        });
    }).then(function() {
        return X.ChangeWindowAttributes(root, {
            eventMask: (
                x11.eventMask.SubstructureNotify |
                x11.eventMask.SubstructureRedirect |
                x11.eventMask.ResizeRedirect |
                x11.eventMask.PropertyChange |
                x11.eventMask.KeyPress |
                x11.eventMask.KeyRelease
            )
        });
    }).then(function() {
        return promisify(X.require, X, "composite");
    }).then(function(extension) {
        Composite = extension;

        return promisify(X.require, X, "damage");
    }).then(function(extension) {
        Damage = extension;

        return promisify(X.require, X, "randr");
    }).then(function(extension) {
        Randr = extension;

        Randr.SelectInput(root, Randr.NotifyMask.ScreenChange);

        return promisify(Composite.GetOverlayWindow, X, root);
    }).then(function(overlayWindowId) {
        mainWindowId = main.window.getNativeWindowHandle().readUint32LE();

        X.ReparentWindow(mainWindowId, overlayWindowId, 0, 0);

        var promiseChain = Promise.resolve();

        REQUIRED_ATOMS.forEach(function(atomToCreate) {
            promiseChain = promiseChain.then(function() {
                return promisify(X.InternAtom, X, false, atomToCreate);
            }).then(function(atomId) {
                atoms[atomToCreate] = atomId;

                return Promise.resolve();
            });
        });

        return promiseChain;
    }).then(function() {
        var supportedAtomsBuffer = Buffer.alloc(SUPPORTED_ATOMS.length * 4);
        var offset = 0;

        SUPPORTED_ATOMS.forEach(function(atom) {
            offset = supportedAtomsBuffer.writeUint32LE(atoms[atom], offset);
        });

        X.ChangeProperty(0, root, atoms["_NET_SUPPORTED"], X.atoms.ATOM, SUPPORTED_ATOMS.length * 32, supportedAtomsBuffer);

        return Promise.resolve();
    });
};