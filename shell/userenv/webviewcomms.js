/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as webviewManager from "gshell://userenv/webviewmanager.js";
import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";
import * as permissions from "gshell://config/permissions.js";
import * as investigator from "gshell://userenv/investigator.js";
import * as a11y from "gshell://a11y/a11y.js";
import * as input from "gshell://input/input.js";
import * as tooltips from "gshell://global/tooltips.js";
import * as select from "gshell://global/select.js";

var webviewEvents = [];

export class WebviewEvent {
    constructor(data) {
        Object.assign(this, data);
    }
}

export function send(webview, message, data, sendToSubframes = false) {
    webview.getAll().forEach(function(element) {
        gShell.call("webview_send", {
            webContentsId: element.getWebContentsId(),
            message,
            data,
            sendToSubframes
        });
    });
}

export function onEvent(eventNames, callback) {
    eventNames.split(" ").forEach((eventName) => webviewEvents.push({eventName, callback}));
}

export function attach(webview, privileged, user = null) {
    webview.getAll().forEach(function(element) {
        element.isPrivileged = !!privileged;

        element.addEventListener("did-attach", function() {
            gShell.call("webview_attach", {
                webContentsId: element.getWebContentsId(),
                userAgent: webviewManager.userAgent,
                userAgentMetadata: webviewManager.userAgentMetadata
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

            case "privilegedCommand":
                if (!privileged) {
                    send(webview, "callback", {
                        id: event.args[1]._id,
                        resolved: false,
                        data: "Unable to call privileged command: not running in privileged webview"
                    });

                    break;
                }

                if (Object.keys(privilegedInterface.commands).includes(event.args[0])) {
                    privilegedInterface.commands[event.args[0]](event.args[1], {webview, user}).then(function(data) {
                        send(webview, "callback", {
                            id: event.args[1]._id,
                            resolved: true,
                            data
                        });
                    }).catch(function(data) {
                        send(webview, "callback", {
                            id: event.args[1]._id,
                            resolved: false,
                            data
                        });

                        console.warn("Received rejection when calling privileged command:", data);
                    });
                } else {
                    console.warn(`Invalid privileged command: ${event.args[0]}`);
                }

                break;

            case "ready":
                fetch("gshell://common.css").then(function(response) {
                    return response.text();
                }).then(function(styleCode) {
                    send(webview, "readyResponse", {
                        styleCode
                    }, true);
                });

                break;

            case "openFrame":
                webview.emit("openframe", event.args[0]);
                break;

            case "permissions_setSelectUsbDeviceFilters":
                permissions.setSelectUsbDeviceFilters(webview, event.args[0]);
                break;

            case "investigator_response":
                investigator.handleResponse(event.args[0]);
                break;

            case "investigator_event":
                investigator.handleEvent(webview, event.args[0]);
                break;

            case "input_show":
                input.show();
                break;

            case "input_hide":
                input.hide();
                break;

            case "tooltips_show":
                tooltips.show(event.args[0]);
                break;

            case "tooltips_hide":
                tooltips.hide();
                break;

            case "select_open":
                select.setFakeArea(webview, event.args[0]);
                select.setCallbackFromWebview(webview);
                select.open(undefined, select.itemObjectsToElements(event.args[1]));

                break;
        }
    });
}

export function update(webview = $g.sel("body webview")) {
    webview.forEach(function(singleWebview) {
        send(singleWebview, "update", {
            a11y_options: a11y.options,
            input_showing: input.showing,
            isPrivileged: singleWebview.get().isPrivileged,
            privilegedData: singleWebview.get().isPrivileged ? privilegedInterface.data : null
        }, true);
    });
}