/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as webviewComms from "gshell://userenv/webviewcomms.js";

function uaFor(renderer) {
    return navigator.userAgent.match(new RegExp(`(${renderer}\\/[0-9.]+)`))[1];
}

// TODO: Store version number for LiveG OS and Sphere in central location so that it can be used in places like the user agent and elsewhere

export const USER_AGENT = `Mozilla/5.0 (Linux; LiveG OS 0.1.0) ${uaFor("AppleWebKit")} (KHTML, like Gecko) ${uaFor("Chrome")} Mobile ${uaFor("Safari")} Sphere/0.1.0`;

export const USER_AGENT_METADATA = {
    platform: "LiveG OS",
    platformVersion: "0.1.0",
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
            version: "0.1.0"
        }
    ]
};

export function spawn(url, privileged = false) {
    var webview = $g.create("webview");

    webviewComms.attach(webview, privileged);

    webview.setAttribute("src", url);
    webview.setAttribute("preload", "./webviewpreload.js");
    webview.setAttribute("useragent", USER_AGENT);

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