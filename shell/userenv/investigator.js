/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var responseCallbacks = [];
var eventListeners = [];
var webviewListenedEvents = [];
var webviewsWithCspBypass = [];

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
        listenedEvent.webview.get() == webview.get() &&
        listenedEvent.eventType == eventType &&
        listenedEvent.destinationWebview.get() == destinationWebview.get()
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
        var webContentsId = webview.get().getWebContentsId();
        var shouldSetBypassCsp = false;

        responseCallbacks.push({resolve, reject});

        if (command == "evaluate" && !webviewsWithCspBypass.includes(webview.get())) {
            shouldSetBypassCsp = true;

            webviewsWithCspBypass.push(webview.get());
        }

        (shouldSetBypassCsp ? gShell.call("webview_setCspBypass", {webContentsId, enabled: true}) : Promise.resolve()).then(function() {
            gShell.call("webview_send", {
                webContentsId,
                message: "investigator_command",
                data: {
                    id: responseCallbacks.length - 1,
                    command,
                    data
                },
                sendToSubframes: false
            });
        });
    });
}