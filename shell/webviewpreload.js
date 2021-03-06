/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

const FOCUSABLES = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]:not(:disabled), [tabindex]:not([tabindex=\"-1\"]):not(:disabled)";

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
var privilegedDataUpdateCallbacks = [];
var lastInputScrollLeft = 0;
var shouldSkipNextInputShow = false;

function isTextualInput(element) {
    return element.matches("input") && !(NON_TEXTUAL_INPUTS.includes(String(element.getAttribute("type") || "").toLowerCase()));
}

electron.contextBridge.exposeInMainWorld("_sphere", {
    callPrivilegedCommand: function(command, data) {
        electron.ipcRenderer.sendToHost("privilegedCommand", command, data);
    },
    getPrivilegedData: function() {
        return mainState.privilegedData || null;
    },
    onPrivilegedDataUpdate: function(callback) {
        privilegedDataUpdateCallbacks.push(callback);
    }
});

window.addEventListener("load", function() {
    setInterval(function() {
        lastInputScrollLeft = document.activeElement.scrollLeft;
    });

    window.addEventListener("click", function(event) {
        if (mainState.a11y_options?.switch_enabled) {
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

    ["keyup", "keydown", "click", "pointerup", "pointerdown", "focusin", "focusout"].forEach(function(type) {
        window.addEventListener(type, function(event) {
            var eventObject = {};
    
            for (var key in event) {
                if (["string", "number", "boolean", "bigint"].includes(typeof(event[key])) || event[key] == null) {
                    eventObject[key] = event[key];
                }
            }

            var targetRect = event.target.getBoundingClientRect();

            eventObject.targetTop = targetRect.top;
            eventObject.targetLeft = targetRect.left;
            eventObject.targetWidth = targetRect.width;
            eventObject.targetHeight = targetRect.height;
    
            electron.ipcRenderer.sendToHost("eventPropagation", type, eventObject);
        });
    });

    window.addEventListener("click", function(event) {
        if (isTextualInput(event.target)) {
            electron.ipcRenderer.sendToHost("input_show");
        }
    });

    window.addEventListener("focusin", function(event) {
        if (!mainState.a11y_options?.switch_enabled && isTextualInput(event.target) && !shouldSkipNextInputShow) {
            electron.ipcRenderer.sendToHost("input_show");
        }

        shouldSkipNextInputShow = false;
    });

    window.addEventListener("focusout", function(event) {
        if (isTextualInput(document.activeElement)) {
            shouldSkipNextInputShow = true;
        }

        if (mainState.a11y_options?.switch_enabled && isTextualInput(event.target)) {
            event.target.scrollLeft = lastInputScrollLeft;
        }
    });

    window.addEventListener("keydown", function(event) {
        if (
            event.key == " " &&
            isTextualInput(document.activeElement) &&
            mainState.a11y_options?.switch_enabled &&
            !mainState.input_showing
        ) {
            event.preventDefault();

            electron.ipcRenderer.sendToHost("input_show");
        }
    });

    window.addEventListener("keydown", function(event) {
        if (!mainState.a11y_options?.switch_enabled) {
            return;
        }

        if (event.target.matches("[aria-role='group']")) {
            if (event.key == "Tab") {
                event.target.querySelectorAll("*").forEach((element) => element.setAttribute("tabindex", "-1"));
            }

            if (event.key == " ") {
                event.target.querySelectorAll("*").forEach((element) => element.removeAttribute("tabindex"));

                event.target.querySelector(FOCUSABLES)?.focus();
            }
        }
    });

    electron.ipcRenderer.on("update", function(event, data) {
        mainState = data;

        document.querySelector("body").setAttribute("liveg-a11y-scancolour", data.a11y_options.switch_enabled ? data.a11y_options.switch_scanColour : "");

        if (data.isPrivileged) {
            privilegedDataUpdateCallbacks.forEach((callback) => callback(data.privilegedData));
        } else {
            mainState.privilegedData = null;
        }
    });

    electron.ipcRenderer.on("input_scrollIntoView", function() {
        document.activeElement.scrollIntoView({block: "nearest", inline: "nearest"});
    });
});