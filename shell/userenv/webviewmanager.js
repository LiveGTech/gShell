/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as webviewComms from "gshell://userenv/webviewcomms.js";
import * as users from "gshell://config/users.js";
import * as about from "gshell://about.js";

function uaFor(renderer) {
    return navigator.userAgent.match(new RegExp(`(${renderer}\\/[0-9.]+)`))[1];
}

// TODO: Store version number for LiveG OS and Sphere in central location so that it can be used in places like the user agent and elsewhere

export const USER_AGENT = `Mozilla/5.0 (Linux; LiveG OS ${about.VERSION}) ${uaFor("AppleWebKit")} (KHTML, like Gecko) ${uaFor("Chrome")} Mobile ${uaFor("Safari")} Sphere/${about.VERSION}`;

export const USER_AGENT_METADATA = {
    platform: "LiveG OS",
    platformVersion: about.VERSION,
    model: "Prism",
    architecture: "aarch64",
    bitness: "64",
    mobile: true,
    brands: [
        {
            brand: "Chromium",
            version: uaFor("Chrome").split("/")[1].split(".")[0]
        },
        {
            brand: "Sphere",
            version: "0"
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

export function spawn(url, options = {}) {
    var webview = $g.create("webview");

    webviewComms.attach(webview, !!options.privileged);

    if (options.private) {
        options.partition = "private";
    }

    webview.setAttribute("src", url);
    webview.setAttribute("preload", "./webviewpreload.js");
    webview.setAttribute("useragent", USER_AGENT);

    if (!url.startsWith("gshell://")) {
        webview.setAttribute("partition", options.partition || "private");
    }

    webview.on("click", function() {
        webview.focus();
    });

    webview.on("did-start-loading dom-ready", function() {
        webviewComms.update(webview);

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

    return webview;
}

export function spawnAsUser(url, user = null, options = {}) {
    return (user == null ? users.getCurrentUser() : Promise.resolve(user)).then(function(user) {
        if (typeof(user.uid) == "string") {
            options.partition = `persist:${user.uid}`;
        } else {
            console.warn("User's UID was not available when attempting to spawn webview for user");
        }

        return Promise.resolve(spawn(url, options));
    });
}

gShell.call("webview_acknowledgeUserAgent", {userAgent: USER_AGENT});