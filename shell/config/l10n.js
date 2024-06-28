/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as config from "gshell://config/config.js";
import * as info from "gshell://global/info.js";
import * as home from "gshell://userenv/home.js";

export var currentLocale = null;

export function apply(localeCode = "en_GB") {
    return $g.l10n.selectLocaleFromResources({
        "ca_ES": "gshell://locales/ca_ES.json",
        "en_GB": "gshell://locales/en_GB.json",
        "fr_FR": "gshell://locales/fr_FR.json"
    }, "en_GB", {
        "ca_ES": "en_GB",
        "fr_FR": "en_GB"
    }, localeCode).then(function(locale) {
        window._ = function() {
            return locale.translate(...arguments);
        };

        window._format = function() {
            return locale.format(...arguments);
        };

        currentLocale = locale;

        $g.l10n.translateApp(locale);

        gShell.call("webview_setLocale", {localeCode});

        info.applyAll();
        home.load();

        return Promise.resolve();
    });
}

export function loadFromConfig() {
    return config.read("l10n.gsc").then(function(data) {
        return apply(data.localeCode || "en_GB");
    });
}

export function setLocale(localeCode) {
    return apply(localeCode).then(function() {
        return config.edit("l10n.gsc", function(data) {
            data.localeCode = localeCode;
    
            return Promise.resolve(data);
        });
    });
}
