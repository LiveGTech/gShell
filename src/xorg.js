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
    Composite.RedirectWindow(windowId, Composite.Redirect.Manual);
    X.MapWindow(windowId);
    X.RaiseWindow(mainWindowId);

    var pixmapId = X.AllocID();
    
    Composite.NameWindowPixmap(windowId, pixmapId);

    trackedWindows.push({windowId, pixmapId});
}

function releaseWindow(windowId) {
    var id = trackedWindows.findIndex((trackedWindow) => trackedWindow?.windowId == windowId);
    var trackedWindow = trackedWindows[id];

    if (!trackedWindow) {
        return;
    }

    X.ReleaseID(windowId);

    trackedWindows[id] = null;
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
    }).then(function(image) {
        console.log(image);

        // TODO: Mask to allow transparency and convert to bitmap
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

                    // TODO: Track for repaints using Damage extension

                    setInterval(function() {
                        exports.getWindowSurfaceImage(0);
                    }, 1000);

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

        return Promise.resolve();
    });
};