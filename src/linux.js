/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const fs = require("fs");
const glob = require("glob");
const mime = require("mime-types");

var flags = require("./flags");

exports.getNamedAppIconPath = function(iconName) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve(null);
    }

    if (typeof(iconName) != "string" || iconName.trim() == "") {
        return Promise.resolve(null);
    }

    if (iconName.startsWith("/")) {
        return Promise.resolve(iconName);
    }

    var promiseChain = Promise.resolve();

    var pathsToCheck = [
        `/usr/share/icons/hicolor/*/apps/${iconName}.png`,
        `/usr/local/share/icons/hicolor/*/apps/${iconName}.png`
    ];

    var bestImagePath = null;
    var bestImageSize = null;

    pathsToCheck.forEach(function(path) {
        var indexContainingWidth = path.split("/").indexOf("*");

        promiseChain = promiseChain.then(function() {
            return glob.glob(path);
        }).then(function(results) {
            results.forEach(function(resultPath) {
                if (indexContainingWidth < 0) {
                    if (bestImageSize == null) {
                        bestImagePath = resultPath;
                    }

                    return;
                }

                var resolutionMatch = resultPath.split("/")[indexContainingWidth].match(/^(\d+)x(\d+)$/);

                if (!resolutionMatch) {
                    return;
                }

                var sizeValue = parseInt(resolutionMatch[1]) * parseInt(resolutionMatch[2]);

                if (bestImageSize > sizeValue) {
                    return;
                }

                bestImagePath = resultPath;
                bestImageSize = sizeValue;
            });
        });
    });

    return promiseChain.then(function() {
        // TODO: Maybe return as some sort of image data
        return Promise.resolve(bestImagePath);
    });
};

exports.getNamedAppIcon = function(iconName) {
    return exports.getNamedAppIconPath(iconName).then(function(path) {
        if (path == null || !path.endsWith(".png")) {
            return Promise.resolve(null);
        }

        return Promise.resolve({
            mimeType: mime.lookup(path),
            data: fs.readFileSync(path)
        });
    });
}

exports.getAppInfo = function(processName) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve(null);
    }

    var desktopEntryPath = null;
    var desktopEntryData = null;

    var pathsToCheck = [
        `/usr/share/applications/${processName}.desktop`,
        `/usr/local/share/applications/${processName}.desktop`
    ];

    for (var i = 0; i < pathsToCheck.length; i++) {
        if (fs.existsSync(pathsToCheck[i])) {
            desktopEntryPath = pathsToCheck[i];
            desktopEntryData = fs.readFileSync(pathsToCheck[i], "utf-8");

            break;
        }
    }

    if (desktopEntryData == null) {
        return Promise.resolve(null);
    }

    var properties = {};
    var currentSection = "Desktop Entry";

    desktopEntryData.split("\n").forEach(function(line) {
        var sectionMatch = line.match(/^\[(.*)\]$/);

        if (sectionMatch) {
            currentSection = sectionMatch[1];
        }

        if (currentSection != "Desktop Entry") {
            return;
        }

        var parts = line.split("=");

        if (parts.length < 2) {
            return;
        }

        properties[parts[0]] = parts.slice(1).join("=");
    });

    var localisedNames = {};

    Object.keys(properties).forEach(function(key) {
        var match = key.match(/^Name\[(.*)\]$/);

        if (!match) {
            return;
        }

        localisedNames[match[1]] = properties[key];
    });

    return exports.getNamedAppIcon(properties["Icon"]).then(function(icon) {
        return Promise.resolve({
            name: properties["Name"] || null,
            localisedNames,
            desktopEntryPath,
            command: properties["Exec"],
            icon
        });
    });
};