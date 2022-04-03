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

var mainState = {};

function isTextualInput(element) {
    return element.matches("input") && !(NON_TEXTUAL_INPUTS.includes(String(element.getAttribute("type") || "").toLowerCase()));
}

window.addEventListener("load", function() {
    ["focusin", "mousedown", "touchstart"].forEach(function(eventName) {
        window.addEventListener(eventName, function(event) {
            if (mainState.a11y_options.switch_enabled) {
                return;
            }

            if (event.target.matches("label")) {
                return;
            }

            if (event.target.matches("input")) {
                if (!isTextualInput(event.target)) {
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

    ["keyup", "keydown", "click"].forEach(function(type) {
        window.addEventListener(type, function(event) {
            var eventObject = {};
    
            for (var key in event) {
                if (["string", "number", "boolean", "bigint"].includes(typeof(event[key])) || event[key] == null) {
                    eventObject[key] = event[key];
                }
            }
    
            electron.ipcRenderer.sendToHost("eventPropagation", type, eventObject);
        });
    });

    window.addEventListener("click", function(event) {
        if (isTextualInput(event.target)) {
            electron.ipcRenderer.sendToHost("input_show");
        }
    });

    window.addEventListener("keydown", function(event) {
        if (
            event.key == " " &&
            isTextualInput(document.activeElement) &&
            mainState.a11y_options.switch_enabled &&
            !mainState.input_showing
        ) {
            event.preventDefault();

            electron.ipcRenderer.sendToHost("input_show");
        }
    });

    electron.ipcRenderer.on("update", function(event, data) {
        mainState = data;

        document.querySelector("body").setAttribute("liveg-a11y-scancolour", data.a11y_options.switch_enabled ? data.a11y_options.switch_scanColour : "");
    });

    electron.ipcRenderer.on("input_scrollIntoView", function() {
        document.activeElement.scrollIntoView({block: "nearest", inline: "nearest"});
    });
});