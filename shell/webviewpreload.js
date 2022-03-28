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
        
                return;
            }
        
            electron.ipcRenderer.sendToHost("input_hide");
        
            return;
        });
    });
});