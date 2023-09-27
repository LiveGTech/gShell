/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const x11 = require("x11");

var flags = require("./flags");

var display;
var root;
var X;
var Composite;
var Damage;

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

            resolve();
        }).on("event", function(event) {
            console.log("EVENT:", event);

            if (event.name == "MapRequest") {
                X.MapWindow(event.wid);
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

        Composite.RedirectSubwindows(root, Composite.Redirect.Automatic);

        return Promise.resolve();
    });
};