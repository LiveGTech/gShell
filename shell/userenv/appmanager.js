/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as config from "gshell://config/config.js";
import * as l10n from "gshell://config/l10n.js";
import * as users from "gshell://config/users.js";
import * as home from "gshell://userenv/home.js";

export class ManifestData {
    constructor(manifest, scope) {
        this.isPresent = true;
        this.isValid = true;
        this.manifest = manifest;
        this.scope = scope;
    }

    get name() {
        return this.manifest.short_name || this.manifest.name;
    }

    get url() {
        return new URL(
            this.manifest.start_url || this.manifest.scope || ".",
            this.scope
        ).href;
    }

    get icon() {
        if (!Array.isArray(this.manifest.icons)) {
            return null;
        }

        var bestIcon = (this.manifest.icons || [])
            .sort(function(a, b) {
                const BETTER = -1;
                const WORSE = 1;

                if (a.purpose == "maskable") {
                    return BETTER;
                }

                function getIconMaxSize(icon) {
                    var sizesString = icon.sizes;
                    var biggestSize = 0;

                    sizesString.split(" ").forEach(function(sizeString) {
                        var match = sizeString.match(/^(\d+)x(\d+)$/);

                        if (!match) {
                            return;
                        }

                        var sizeValue = parseInt(match[1]) * parseInt(match[2]);

                        if(sizeValue > biggestSize) {
                            biggestSize = sizeValue;
                        }
                    });

                    return biggestSize;
                }

                return getIconMaxSize(b) - getIconMaxSize(a);
            })[0]?.src
        ;

        if (!bestIcon) {
            return null;
        }

        return new URL(bestIcon, this.scope).href;
    }

    static deserialise(data) {
        var instance = new this(data.manifest, data.scope);

        instance.isPresent = data.isPresent;
        instance.isValid = data.isValid;

        return instance;
    }
}

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

export function installFromManifestData(manifestData) {
    if (!manifestData.isValid) {
        return Promise.reject("Manifest is invalid and so cannot be used for installation");
    }

    var localeCode = l10n.currentLocale.localeCode;

    return install({
        scope: manifestData.scope,
        fallbackLocale: localeCode,
        name: {
            [localeCode]: manifestData.name
        },
        url: manifestData.url,
        icon: manifestData.icon
    });
}