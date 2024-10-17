/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as device from "gshell://system/device.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";
import * as users from "gshell://config/users.js";
import * as about from "gshell://about.js";

function uaFor(renderer) {
    return navigator.userAgent.match(new RegExp(`(${renderer}\\/[0-9.]+)`))[1];
}

export var userAgent = null;

export var userAgentMetadata = {
    platform: "LiveG OS",
    platformVersion: about.VERSION,
    architecture: "generic",
    bitness: "64",
    brands: [
        {
            brand: "Chromium",
            version: uaFor("Chrome").split("/")[1].split(".")[0]
        },
        {
            brand: "Sphere",
            version: about.VERSION.split(".")[0]
        }
    ],
    fullVersionList: [
        {
            brand: "Chromium",
            version: uaFor("Chrome").split("/")[1]
        },
        {
            brand: "Sphere",
            version: about.VERSION
        }
    ]
};

export var preloadPath = null;

export var webviewsByWebContentsId = {};

export function spawn(url, options = {}) {
    var webview = $g.create("webview");

    webviewComms.attach(webview, !!options.privileged, options.user || null);

    if (options.private) {
        options.partition = "private";
    }

    webview.setAttribute("src", url);
    webview.setAttribute("preload", preloadPath);
    webview.setAttribute("useragent", userAgent);
    webview.setAttribute("allowpopups", true);
    webview.setAttribute("nodeintegrationinsubframes", true);

    if (!url.startsWith("gshell://")) {
        webview.setAttribute("partition", options.partition || "private");
    }

    webview.on("click", function() {
        webview.focus();
    });

    webview.on("did-start-loading dom-ready", function() {
        webviewComms.update(webview);

        webviewsByWebContentsId[webview.get().getWebContentsId()] = webview;

        // Apply the User Agent Stylesheet (UAS)
        fetch("gshell://userenv/webviewuas.css").then(function(response) {
            return response.text();
        }).then(function(styleCode) {
            webview.get().insertCSS(styleCode, {cssOrigin: "user"});
        });

        // Apply the Author Stylesheet (AS)
        fetch("gshell://userenv/webviewas.css").then(function(response) {
            return response.text();
        }).then(function(styleCode) {
            webview.get().insertCSS(styleCode, {cssOrigin: "author"});
        });

        fetch("gshell://common.css").then(function(response) {
            return response.text();
        }).then(function(styleCode) {
            webview.get().insertCSS(styleCode);
        });
    });

    webview.on("did-start-loading", function() {
        // Apply common code shared between gShell and `webview`s
        fetch("gshell://common.js").then(function(response) {
            return response.text();
        }).then(function(scriptCode) {
            webview.get().executeJavaScript(scriptCode);
        });
    });

    return webview;
}

export function spawnAsUser(url, user = null, options = {}) {
    return (user == null ? users.getCurrentUser() : Promise.resolve(user)).then(function(user) {
        options.user = user;

        if (typeof(user.uid) == "string") {
            options.partition = `persist:${user.uid}`;
        } else {
            console.warn("User's UID was not available when attempting to spawn webview for user");
        }

        return Promise.resolve(spawn(url, options));
    });
}

export function init() {
    userAgent = (
        `Mozilla/5.0 (Linux; LiveG OS ${about.VERSION}) ` +
        `${uaFor("AppleWebKit")} (KHTML, like Gecko) ` +
        `${uaFor("Chrome")} ` +
        (device.data?.type == "mobile" ? "Mobile" : "") + `${uaFor("Safari")} ` +
        `Sphere/${about.VERSION}`
    );

    userAgentMetadata.model = device.data?.model?.name[device.data?.model?.fallbackLocale || "en_GB"];
    userAgentMetadata.mobile = device.data?.type == "mobile";

    return gShell.call("webview_acknowledgeUserAgent", {userAgent}).then(function() {
        return gShell.call("system_getRootDirectory").then(function(rootDirectory) {
            preloadPath = `file://${rootDirectory}/shell/webviewpreload.js`;

            return Promise.resolve();
        });
    });
}