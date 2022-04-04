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

export const USER_AGENT = `Mozilla/5.0 (Linux; LiveG OS 0.1.0) ${uaFor("AppleWebKit")} (KHTML, like Gecko) ${uaFor("Chrome")} ${uaFor("Safari")} Sphere/0.1.0`;

export function spawn(url) {
    var webview = $g.create("webview");

    webviewComms.attach(webview);

    webview.setAttribute("src", url);
    webview.setAttribute("preload", "./webviewpreload.js");
    webview.setAttribute("useragent", USER_AGENT);

    webview.on("click", function() {
        webview.focus();
    });

    webview.on("dom-ready", function() {
        webviewComms.update(webview);

        // Apply the User Agent Stylesheet (UAS)
        fetch("gshell://userenv/webviewuas.css").then(function(response) {
            return response.text();
        }).then(function(styleCode) {
            webview.get().insertCSS(styleCode, {cssOrigin: "user"});
        });

        fetch("gshell://common.css").then(function(response) {
            return response.text();
        }).then(function(styleCode) {
            webview.get().insertCSS(styleCode);
        });
    });

    return webview;
}