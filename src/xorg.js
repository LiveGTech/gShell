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
var mainWindowId = null;
var trackedWindows = [];

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

    trackedWindows.push({windowId, pixmapId, damageId});

    main.window.webContents.send("xorg_trackWindow", {id: trackedWindows.length - 1});
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

exports.getWindowSurfaceImage = function(id) {
    var trackedWindow;

    return getTrackedWindowById(id).then(function(trackedWindowResult) {
        trackedWindow = trackedWindowResult;
    
        return promisify(X.GetGeometry, X, trackedWindow.pixmapId);
    }).then(function(geometry) {
        return promisify(X.GetImage, X, 2, trackedWindow.pixmapId, 0, 0, geometry.width, geometry.height, 0xFFFFFFFF);
    });
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

            resolve();
        }).on("event", function(event) {
            switch (event.name) {
                case "MapRequest":
                    trackWindow(event.wid);
                    break;

                case "DamageNotify":
                    var id = findTrackedWindowIndexByWindowId(event.drawable);
                    var trackedWindow = trackedWindows[id];

                    if (!trackedWindow) {
                        break;
                    }

                    exports.getWindowSurfaceImage(id).then(function(image) {
                        main.window.webContents.send("xorg_repaintWindow", {id, image});

                        console.log("Repaint:", id, image);
                    });

                    Damage.Subtract(trackedWindow.damageId, 0, 0);

                    break;

                case "UnmapNotify":
                    releaseWindow(event.wid);
                    break;
            }
        });
    }).then(function() {
        return X.ChangeWindowAttributes(root, {eventMask: x11.eventMask.SubstructureNotify | x11.eventMask.SubstructureRedirect});
    }).then(function() {
        return promisify(X.require, X, "composite");
    }).then(function(extension) {
        Composite = extension;

        return promisify(X.require, X, "damage");
    }).then(function(extension) {
        Damage = extension;

        return promisify(Composite.GetOverlayWindow, X, root);
    }).then(function(overlayWindowId) {
        X.ReparentWindow(mainWindowId, overlayWindowId, 0, 0);

        return Promise.resolve();
    });
};