/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";
import * as home from "gshell://userenv/home.js";

export function install(appDetails) {
    return users.ensureCurrentUser().then(function(user) {
        return config.edit(`users/${user.uid}/apps.gsc`, function(data) {
            data.apps ||= {};

            data.apps[$g.core.generateKey()] = appDetails;

            // TODO: Save non-gShell app icons locally
            // TODO: Add notification telling user app has been added

            return Promise.resolve(data);
        });
    }).then(function() {
        return home.load();
    });
}