/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const fs = require("fs");
const glob = require("glob");

var flags = require("./flags");

exports.getNamedAppIcon = function(iconName) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve(null);
    }

    if (typeof(iconName) != "string" || iconName.trim() == "") {
        return Promise.resolve(null);
    }

    var promiseChain = Promise.resolve();

    var pathsToCheck = [
        `/usr/share/icons/hicolor/*/apps/${iconName}.png`,
        `/usr/local/share/icons/hicolor/*/apps/${iconName}.png`
    ];

    var bestImagePath = null;
    var bestImageWidth = null;

    pathsToCheck.forEach(function(path) {
        var indexContainingWidth = path.split("/").indexOf("*");

        promiseChain = promiseChain.then(function() {
            return glob.glob(path);
        }).then(function(results) {
            results.forEach(function(resultPath) {
                if (indexContainingWidth < 0) {
                    if (bestImageWidth == null) {
                        bestImagePath = resultPath;
                    }

                    return;
                }

                var resolutionParts = resultPath.split("/")[indexContainingWidth].split("x");
                var width = parseInt(resolutionParts[0]);

                if (resolutionParts.length != 3 || Number.isNaN(width)) {
                    if (bestImageWidth == null) {
                        bestImagePath = resultPath;
                    }

                    return;
                }

                if (bestImageWidth > width) {
                    return;
                }

                bestImagePath = resultPath;
                bestImageWidth = width;
            });
        });
    });

    return promiseChain.then(function() {
        // TODO: Maybe return as some sort of image data
        return Promise.resolve(bestImagePath);
    });
};

exports.getAppInfo = function(processName, localeCode = null) {
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

    return exports.getNamedAppIcon(properties["Icon"]).then(function(icon) {
        return Promise.resolve({
            name: properties["Name"] || null,
            localisedName: localeCode != null ? properties[`Name[${localeCode}]`] || properties[`Name[${localeCode.split("_")[0]}]`] : null,
            desktopEntryPath,
            command: properties["Exec"],
            icon
        });
    });
};