/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const path = require("path");
const fs = require("fs");

var main = require("./main");
var flags = require("./flags");
var system = require("./system");
var storage = require("./storage");

exports.controlFilesystemLocation = path.normalize(`${storage.systemDirectory}/control`);

exports.Property = class {
    constructor(name, defaultValue = "", settable = false, requiresAdmin = false) {
        this.name = name;
        this.defaultValue = defaultValue;
        this.settable = settable;
        this.requiresAdmin = requiresAdmin;

        this._value = defaultValue;
        this._onChangeCallbacks = [];
        this._watching = false;
    }

    get path() {
        return path.join(exports.controlFilesystemLocation, ...this.name.split("/"));
    }

    get parentPath() {
        return path.join(...[exports.controlFilesystemLocation, ...this.name.split("/")].slice(0, -1));
    }

    init() {
        var thisScope = this;

        if (!flags.isRealHardware && !flags.allowAppControl) {
            return Promise.resolve();
        }

        return this.setValue(this.defaultValue).then(function() {
            var permissions = "600";

            if (!thisScope.requiresAdmin) {
                if (thisScope.settable) {
                    permissions = "666";
                } else {
                    permissions = "644";
                }
            }

            return system.executeCommand("chmod", [permissions, thisScope.path]);
        }).then(function() {
            fs.watchFile(thisScope.path, function() {
                thisScope.getValue().then(function(newValue) {
                    thisScope._onChangeCallbacks.forEach((callback) => callback(newValue));
                });
            });

            return Promise.resolve();
        });
    }

    getValue(asString = true) {
        if (!this.settable || (!flags.isRealHardware && !flags.allowAppControl)) {
            return Promise.resolve(this._value);
        }

        return Promise.resolve(fs.readFileSync(this.path, asString ? "utf-8" : null));
    }

    setValue(value) {
        var thisScope = this;

        this._value = value;

        if (!flags.isRealHardware && !flags.allowAppControl) {
            return Promise.resolve();
        }

        return system.executeCommand("mkdir", ["-p", this.parentPath]).then(function() {
            fs.writeFileSync(thisScope.path, value);

            return Promise.resolve();
        });
    }

    onChange(callback) {
        this._onChangeCallbacks.push(callback);
    }
};

exports.PROPERTIES = [
    new exports.Property("actions/openInSphere", "", true),
    new exports.Property("actions/addApp", "", true)
];

exports.getProperty = function(propertyName) {
    return exports.PROPERTIES.find((property) => property.name == propertyName);
};

exports.init = function() {
    if (!flags.isRealHardware && !flags.allowAppControl) {
        return Promise.resolve();
    }

    return system.executeCommand("sudo", ["umount", "-l", exports.controlFilesystemLocation]).catch(() => Promise.resolve()).then(function() {
        return system.executeCommand("rm", ["-rf", exports.controlFilesystemLocation]);
    }).then(function() {
        return system.executeCommand("mkdir", ["-p", exports.controlFilesystemLocation]);
    }).then(function() {
        return system.executeCommand("sudo", ["mount", "-o", "size=16M", "-t", "tmpfs", "none", exports.controlFilesystemLocation]);
    }).then(function() {
        return Promise.all(exports.PROPERTIES.map(function(property) {
            return property.init();
        }));
    }).then(function() {
        exports.PROPERTIES.forEach(function(property) {
            property.onChange(function(value) {
                main.window.webContents.send("control_propertyChange", {
                    name: property.name,
                    value
                });
            });
        });

        return Promise.resolve();
    });
};