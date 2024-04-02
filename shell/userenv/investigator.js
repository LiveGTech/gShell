/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var responseCallbacks = [];
var eventListeners = [];
var webviewListenedEvents = [];

export function handleResponse(responseData) {
    var callbacks = responseCallbacks[responseData.id];

    if (!callbacks) {
        console.warn("Investigator response ID does not match an open callback set");

        return;
    }

    (responseData.type != "error" ? callbacks.resolve : callbacks.reject)(responseData.response);

    responseCallbacks[responseData.id] = null;
}

export function handleEvent(webview, event) {
    eventListeners.forEach(function(listener) {
        if (listener.webview.get() != webview.get()) {
            return;
        }

        if (listener.eventType != event.type) {
            return;
        }

        try {
            listener.callback(event);
        } catch (e) {
            console.error(e);
        }
    });
}

export function onEvent(webview, eventType, callback) {
    if (eventType == "reload") {
        webview.on("dom-ready", function() {
            callback({type: "reload"});
        });

        return;
    }

    eventListeners.push({webview, eventType, callback});

    return call(webview, "listenToEvent", {eventType});
}

export function sendEventsToWebview(webview, eventType, destinationWebview) {
    if (webviewListenedEvents.find((listenedEvent) => (
        listenedEvent.webview == webview &&
        listenedEvent.eventType == eventType &&
        listenedEvent.destinationWebview == destinationWebview
    ))) {
        call(webview, "listenToEvent", {eventType});

        return;
    }

    onEvent(webview, eventType, function(event) {
        destinationWebview.get().send("investigator_event", event);
    });

    webviewListenedEvents.push({webview, eventType, destinationWebview});
}

export function call(webview, command, data = {}) {
    return new Promise(function(resolve, reject) {
        responseCallbacks.push({resolve, reject});

        gShell.call("webview_send", {
            webContentsId: webview.get().getWebContentsId(),
            message: "investigator_command",
            data: {
                id: responseCallbacks.length - 1,
                command,
                data
            },
            sendToSubframes: false
        });
    });
}