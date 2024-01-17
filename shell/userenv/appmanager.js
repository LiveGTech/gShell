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
import * as resources from "gshell://storage/resources.js";
import * as home from "gshell://userenv/home.js";

export const ICON_MIME_TYPES_TO_FILE_EXTENSIONS = {
    "image/svg+xml": "svg",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/x-icon": "ico"
};

function findBestIcon(icons) {
    return icons.sort(function(a, b) {
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

                if (sizeValue > biggestSize) {
                    biggestSize = sizeValue;
                }
            });

            return biggestSize;
        }

        return getIconMaxSize(b) - getIconMaxSize(a);
    })[0].src;
}

export class ManifestShortcut {
    constructor(manifestData, manifestUrl) {
        this.manifestData = manifestData;
        this.manifestUrl = manifestUrl;
    }

    get name() {
        return this.manifestData.name;
    }

    get url() {
        return new URL(this.manifestData.url, this.manifestUrl).href;
    }

    get icon() {
        if (!Array.isArray(this.manifestData.icons) || this.manifestData.icons.length == 0) {
            return null;
        }

        return new URL(findBestIcon(this.manifestData.icons || []), this.manifestUrl).href;
    }
}

export class ManifestData {
    constructor(manifest, manifestUrl, scope) {
        this.isPresent = true;
        this.isValid = true;
        this.manifest = manifest;
        this.manifestUrl = manifestUrl;
        this.scope = scope;
    }

    get name() {
        return this.manifest.short_name || this.manifest.name;
    }

    get url() {
        return new URL(
            this.manifest.start_url || this.manifest.scope || ".",
            this.manifestUrl
        ).href;
    }

    get icon() {
        if (!Array.isArray(this.manifest.icons) || this.manifest.icons.length == 0) {
            return null;
        }

        return new URL(findBestIcon(this.manifest.icons || []), this.manifestUrl).href;
    }

    get shortcuts() {
        return (this.manifest.shortcuts || []).map((shortcut) => new ManifestShortcut(shortcut, this.manifestUrl));
    }

    static deserialise(data) {
        var instance = new this(data.manifest, data.manifestUrl, data.scope);

        instance.isPresent = data.isPresent;
        instance.isValid = data.isValid;

        return instance;
    }
}

export function install(appDetails, updateSameUsingProperties = [], updateOnly = false) {
    var user;
    var resource = null;
    var updated = false;

    // Reverse `updateSameUsingProperties` so that higher-priority properties are applied last
    updateSameUsingProperties = [...updateSameUsingProperties].reverse();

    return users.ensureCurrentUser().then(function(userData) {
        user = userData;

        if (!appDetails.icon) {
            return Promise.resolve();
        }

        var iconUrl = appDetails.icon;
        var mimeType;

        appDetails.icon = null; // Discard URL so that it is never loaded if resource saving fails

        return fetch(iconUrl).then(function(response) {
            mimeType = response.headers.get("Content-Type").split(";")[0];

            if (!(mimeType in ICON_MIME_TYPES_TO_FILE_EXTENSIONS)) {
                return Promise.reject(`Icon MIME type (\`${mimeType}\`) not allowed when installing app: ${iconUrl}`);
            }

            return response.arrayBuffer();
        }).then(function(data) {
            resource = new resources.Resource(ICON_MIME_TYPES_TO_FILE_EXTENSIONS[mimeType], data);

            return resource.save();
        }).then(function() {
            appDetails.icon = resource.url;
            appDetails.iconResourceId = resource.id;

            return Promise.resolve();
        }).catch(function(error) {
            console.warn(error);

            return Promise.resolve();
        });
    }).then(function() {
        return config.edit(`users/${user.uid}/apps.gsc`, function(data) {
            data.apps ||= {};

            var appId = $g.core.generateKey();

            if (updateSameUsingProperties.length > 0) {
                updateSameUsingProperties.reverse().forEach(function(property) {
                    Object.keys(data.apps).forEach(function(otherAppId) {
                        var otherAppDetails = data.apps[otherAppId];

                        if (otherAppDetails[property] == appDetails[property]) {
                            appId = otherAppId;
                            updated = true;
                        }
                    });
                });
            }

            if (updateOnly && !updated) {
                // Don't do anything as we don't want a new entry
                return Promise.resolve(data);
            }

            data.apps[appId] = appDetails;

            // TODO: Add notification telling user app has been added

            return Promise.resolve(data);
        });
    }).then(function() {
        return home.load();
    }).then(function() {
        return Promise.resolve(updated);
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
        icon: manifestData.icon,
        shortcuts: manifestData.shortcuts.map(function(shortcut) {
            return {
                name: {
                    [localeCode]: shortcut.name
                },
                description: shortcut.description ? {
                    [localeCode]: shortcut.description
                } : null,
                url: shortcut.url,
                icon: shortcut.icon
            };
        })
    }, ["scope", "url"]);
}