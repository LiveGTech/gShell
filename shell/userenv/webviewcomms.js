/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as webviewManager from "gshell://userenv/webviewmanager.js";
import * as a11y from "gshell://a11y/a11y.js";
import * as input from "gshell://input/input.js";

var webviewEvents = [];

export class WebviewEvent {
    constructor(data) {
        Object.assign(this, data);
    }
}

export function onEvent(eventNames, callback) {
    eventNames.split(" ").forEach((eventName) => webviewEvents.push({eventName, callback}));
}

export function attach(webview) {
    webview.getAll().forEach(function(element) {
        element.addEventListener("did-attach", function() {
            gShell.call("webview_attach", {
                webContentsId: element.getWebContentsId(),
                userAgent: webviewManager.USER_AGENT,
                userAgentMetadata: webviewManager.USER_AGENT_METADATA
            });
        });
    });

    webview.on("ipc-message", function(event) {
        switch (event.channel) {
            case "eventPropagation":
                webview.get().dispatchEvent(new CustomEvent("webviewevent", {detail: event.args[1], bubbles: true}));

                webviewEvents
                    .filter((webviewEvent) => webviewEvent.eventName == event.args[0])
                    .forEach(function(webviewEvent) {
                        webviewEvent.callback(new WebviewEvent({...event.args[1], targetWebview: webview.get()}));
                    })
                ;

                break;

            case "input_show":
                input.show();
                break;

            case "input_hide":
                input.hide();
                break;
        }
    });
}

export function update(webview = $g.sel("body webview")) {
    webview.getAll().forEach(function(element) {
        element.send("update", {
            a11y_options: a11y.options,
            input_showing: input.showing
        });
    });
}