/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

// From `shell/input/input.js`
const NON_TEXTUAL_INPUTS = [
    "button",
    "checkbox",
    "color",
    "date",
    "datetime-local",
    "file",
    "hidden",
    "image",
    "month",
    "radio",
    "range",
    "reset",
    "submit",
    "time",
    "week"
];

window.addEventListener("load", function() {
    ["focusin", "mousedown", "touchstart"].forEach(function(eventName) {
        window.addEventListener(eventName, function(event) {
            if (event.target.matches("label")) {
                return;
            }

            if (event.target.matches("input")) {
                if (NON_TEXTUAL_INPUTS.includes((event.target.getAttribute("type") || "").toLowerCase())) {
                    electron.ipcRenderer.sendToHost("input_hide");
        
                    return;
                }
        
                electron.ipcRenderer.sendToHost("input_show");

                event.target.focus();
        
                return;
            }
        
            electron.ipcRenderer.sendToHost("input_hide");
        
            return;
        });
    });

    window.addEventListener("keydown", function(event) {
        var eventObject = {};

        for (var key in event) {
            if (["string", "number", "boolean", "bigint"].includes(typeof(event[key])) || event[key] == null) {
                eventObject[key] = event[key];
            }
        }

        electron.ipcRenderer.sendToHost("eventPropagation", "keydown", eventObject);
    });

    electron.ipcRenderer.on("update", function(event, data) {
        document.querySelector("body").setAttribute("liveg-a11y-scan", data.a11y_options.switch_enabled ? data.a11y_options.switch_scanColour : "");
    });

    electron.ipcRenderer.on("scrollInputIntoView", function() {
        document.activeElement.scrollIntoView({block: "nearest", inline: "nearest"});
    });
});