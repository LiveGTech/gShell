/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");

const FOCUSABLES = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]:not(:disabled), [tabindex]:not([tabindex=\"-1\"]):not(:disabled)";

// From `shell/input/input.js`
const INPUT_SELECTOR = `input, textarea, [contenteditable], [aria-role="input"]`;

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

var hasInitialised = false;
var mainState = {};
var privilegedDataIdCounter = 0;
var privilegedDataUpdateCallbacks = [];
var privilegedDataResponseQueue = {};
var lastInputScrollLeft = 0;
var shouldSkipNextInputShow = false;
var lastTooltip = null;

function isTextualInput(element) {
    return element.matches(INPUT_SELECTOR) && !(NON_TEXTUAL_INPUTS.includes(String(element.getAttribute("type") || "").toLowerCase()));
}

electron.contextBridge.exposeInMainWorld("_sphere", {
    callPrivilegedCommand: function(command, data = {}) {
        var id = privilegedDataIdCounter++;

        electron.ipcRenderer.sendToHost("privilegedCommand", command, {...data, _id: id});

        return new Promise(function(resolve, reject) {
            setInterval(function() {
                var response = privilegedDataResponseQueue[id];

                if (response) {
                    (response.resolved ? resolve : reject)(response.data);

                    delete privilegedDataResponseQueue[id];
                }
            });
        });
    },
    getPrivilegedData: function() {
        return mainState.privilegedData || null;
    },
    onPrivilegedDataUpdate: function(callback) {
        privilegedDataUpdateCallbacks.push(callback);
    }
});

window.addEventListener("DOMContentLoaded", function() {
    setInterval(function() {
        lastInputScrollLeft = document.activeElement.scrollLeft;

        document.querySelectorAll("[title]").forEach(function(element) {
            element.setAttribute("sphere-:title", Element.prototype.getAttribute.apply(element, ["title"]));
            element.removeAttribute("title");
        });
    });

    window.addEventListener("click", function(event) {
        if (mainState.a11y_options?.switch_enabled) {
            return;
        }

        if (event.target.matches("label")) {
            return;
        }

        if (event.target.matches(INPUT_SELECTOR)) {
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
            if (!event.isTrusted) {
                return;
            }

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

    window.addEventListener("mousemove", function(event) {
        if (!event.isTrusted) {
            return;
        }

        var closestTitleElement = event.target;
        var currentTooltip = null;

        while (true) {
            if (closestTitleElement.hasAttribute && closestTitleElement.hasAttribute("sphere-:title")) {
                currentTooltip = closestTitleElement.getAttribute("sphere-:title");

                break;
            }

            if (closestTitleElement == document) {
                break;
            }

            closestTitleElement = closestTitleElement.parentNode;
        }

        if (currentTooltip != lastTooltip) {
            lastTooltip = currentTooltip;

            if (currentTooltip != null) {
                electron.ipcRenderer.sendToHost("tooltips_show", currentTooltip);
            } else {
                electron.ipcRenderer.sendToHost("tooltips_hide");
            }
        }
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

            return;
        }

        if (event.key == " " && event.target.matches("a")) {
            event.target.click();

            event.preventDefault();
        }
    });

    electron.ipcRenderer.on("readyResponse", function(event, data) {
        if (hasInitialised) {
            return;
        }

        hasInitialised = true;

        var styleElement = document.createElement("style");
        
        styleElement.textContent = data.styleCode;

        document.head.append(styleElement);
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

    electron.ipcRenderer.on("callback", function(event, data) {
        privilegedDataResponseQueue[data.id] = data;
    });

    electron.ipcRenderer.on("openFrame", function(event, data) {
        // TODO: Add event on host that opens a new window when triggered

        console.log(data);
    });

    electron.ipcRenderer.on("input_scrollIntoView", function() {
        document.activeElement.scrollIntoView({block: "nearest", inline: "nearest"});
    });

    electron.ipcRenderer.sendToHost("ready");
});