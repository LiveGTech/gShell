/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as l10n from "gshell://config/l10n.js";
import * as users from "gshell://config/users.js";
import * as switcher from "gshell://userenv/switcher.js";
import * as appManager from "gshell://userenv/appmanager.js";
import * as term from "gshell://system/term.js";

export var processNameAssociations = {};

export function associateProcessName(processName, appName) {
    // This is needed as some processes have different names to their .desktop filenames

    if (processName == appName) {
        return;
    }

    processNameAssociations[processName] = appName;
}

export function resolveProcessName(processName) {
    return processNameAssociations[processName] || processName;
}

export function addAppToList(processName) {
    processName = resolveProcessName(processName);
    
    return gShell.call("linux_getAppInfo", {processName}).then(function(appInfo) {
        var localeCode = l10n.currentLocale.localeCode;
        var iconData = undefined;
        var iconMimeType = undefined;

        associateProcessName(appInfo.command.split(" ")[0], processName);

        if (appInfo.icon) {
            iconData = appInfo.icon.data.buffer;
            iconMimeType = appInfo.icon.mimeType;
        }

        appManager.install({
            fallbackLocale: localeCode,
            name: {
                [localeCode]: appInfo.name || processName,
                ...appInfo.localisedNames
            },
            url: `gsspecial://linuxapp?name=${encodeURIComponent(processName)}`,
            iconData,
            iconMimeType,
            fitIcon: !!appInfo.icon
        }, ["url"]);
    });
}

export function launchApp(processName) {
    var user;

    return users.ensureCurrentUser().then(function(returnedUser) {
        user = returnedUser;

        return gShell.call("linux_getAppInfo", {processName});
    }).then(function(appInfo) {
        var commandParts = [];
        var currentPart = "";
        var inString = false;
        var inEscape = false;
        var inExpansion = false;

        // Command expansion spec: https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html
        for (var i = 0; i < appInfo.command.length; i++) {
            var char = appInfo.command[i];

            if (inEscape) {
                inEscape = false;
                currentPart += char;
                continue;
            }

            if (inExpansion) {
                inExpansion = false;

                switch (char) {
                    case "%":
                        currentPart += "%";
                        continue;

                    default:
                        continue;
                }
            }

            if (char == "\\") {
                inEscape = true;
                continue;
            }

            if (char == "%") {
                inExpansion = true;
                continue;
            }

            if (char == "\"") {
                inString = !inString;
                continue;
            }

            if (!inString && char == " ") {
                commandParts.push(currentPart);

                currentPart = "";

                continue;
            }

            currentPart += char;
        }

        commandParts.push(currentPart);

        var command = commandParts.shift();
        var args = commandParts;

        associateProcessName(command, processName);

        if (appInfo.requiresTerminal) {
            var commandLine = [command, ...args].map((part) => part
                .replace(/\\/g, "\\\\")
                .replace(/"/g, "\\\"")
                .replace(/ /g, "\\ ")
            ).join(" ");

            switcher.openApp(`gshell://apps/terminal/index.html?exec=${encodeURIComponent(commandLine)}`, {
                icon: "gshell://apps/terminal/icon.svg"
            });

            return;
        }

        term.createForPrivilegedInterface({user, useSystemUserInSimulator: true}, command, args, {
            env: {
                "GOS_LAUNCHED": "1"
            }
        }).then(function(key) {
            var terminal = term.getTerminalByKey(key);
        
            terminal.spawn();
        });
    });
}

export function init() {
    gShell.on("control_propertyChange", function(event, data) {
        if (data.name == "actions/addApp") {
            addAppToList(data.value.trim());
        }
    });
}