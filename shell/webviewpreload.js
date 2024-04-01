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
var isPrivileged = false;
var privilegedDataIdCounter = 0;
var privilegedDataUpdateCallbacks = [];
var privilegedDataEventListeners = [];
var privilegedDataResponseQueue = {};
var privilegedDataAccessWaitQueue = [];
var lastInputScrollLeft = 0;
var shouldSkipNextInputShow = false;
var lastTooltip = null;
var currentSelectElement = null;
var privilegedDataUpdated = false;

var investigatorListeningEventTypes = {};
var investigatorConsoleLogs = [];

function isTextualInput(element) {
    return element.matches(INPUT_SELECTOR) && !(NON_TEXTUAL_INPUTS.includes(String(element.getAttribute("type") || "").toLowerCase()));
}

function openSelect(element) {
    currentSelectElement = element;

    var bounds = element.getBoundingClientRect();

    var items = [...element.querySelectorAll("option, optgroup, hr")].map(function(element) {
        if (element.matches("option")) {
            return {
                type: "option",
                text: element.textContent,
                value: element.value
            };
        }

        if (element.matches("optgroup")) {
            return {
                type: "text",
                text: element.textContent
            };
        }

        if (element.matches("hr")) {
            return {type: "divider"};
        }

        return null;
    });

    electron.ipcRenderer.sendToHost("select_open", {
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height
    }, items);
}

function triggerPrivilegedDataEvent(eventType, data) {
    privilegedDataEventListeners.forEach(function(listener) {
        if (listener.eventType != eventType) {
            return;
        }

        listener.callback(data);
    });
}

function userAgent() {
    var allTerminals = [];

    class TerminalDataEvent extends Event {
        constructor(data) {
            super("data");

            this.data = data;
        }
    }

    class TerminalExitEvent extends Event {
        constructor(exitCode, signal) {
            super("exit");

            this.exitCode = exitCode;
            this.signal = signal;
        }
    }

    class Terminal {
        #key = null;
        #eventListeners = [];
    
        constructor(file, args = [], options = {}) {
            this.file = file;
            this.args = args;
            this.options = options;

            allTerminals.push(this);
        }

        get key() {
            return this.#key;
        }
    
        #ensureAccess() {
            if (!_sphere.isPrivileged()) {
                throw new Error("Permission denied for access to terminal");
            }
        }
    
        spawn() {
            var thisScope = this;
    
            return waitForPrivilegedDataAccess().then(function() {
                thisScope.#ensureAccess();

                return _sphere.callPrivilegedCommand("term_create", {file: thisScope.file, args: thisScope.args, options: thisScope.options});
            }).then(function(key) {
                thisScope.#key = key;
    
                return _sphere.callPrivilegedCommand("term_spawn", {key});
            });
        }

        kill(signal = 9) {
            this.#ensureAccess();

            return _sphere.callPrivilegedCommand("term_kill", {key: this.#key, signal});
        }

        write(data) {
            this.#ensureAccess();

            return _sphere.callPrivilegedCommand("term_write", {key: this.#key, data});
        }

        setSize(columns, rows) {
            this.#ensureAccess();

            return _sphere.callPrivilegedCommand("term_setSize", {key: this.#key, columns, rows});
        }

        addEventListener(eventType, callback) {
            this.#eventListeners.push({eventType, callback});
        }

        dispatchEvent(event) {
            this.#eventListeners.forEach(function(listener) {
                if (listener.eventType != event.type) {
                    return;
                }

                listener.callback(event);
            });
        }
    }

    function waitForPrivilegedDataAccess() {
        return new Promise(function(resolve, reject) {
            _sphere.waitForPrivilegedDataAccess(resolve);
        });
    }

    function dispatchEventForTerminal(key, event) {
        allTerminals.find((terminal) => terminal.key == key).dispatchEvent(event);
    }

    _sphere.onPrivilegedDataEvent("term_read", function(data) {
        dispatchEventForTerminal(data.key, new TerminalDataEvent(data.data));
    });

    _sphere.onPrivilegedDataEvent("term_exit", function(data) {
        dispatchEventForTerminal(data.key, new TerminalExitEvent(data.exitCode, data.signal));
    });

    window.sphere = {
        TerminalDataEvent,
        TerminalExitEvent,
        Terminal
    };

    if (window.navigator.usb) {
        var shadowed_requestDevice = window.navigator.usb.requestDevice;

        window.navigator.usb.requestDevice = function(options) {
            _sphere.permissions_setSelectUsbDeviceFilters(options?.filters || []);
    
            return shadowed_requestDevice.apply(window.navigator.usb, arguments);
        };
    }

    function storeConsoleValues(values) {
        if (!window._investigator_consoleValues) {
            return null;
        }

        window._investigator_consoleValues.push(values);

        return window._investigator_consoleValues.length - 1;
    }

    function logConsoleValues(level, values) {
        _sphere.investigator_consoleLog(level, values.map((value) => String(value)), storeConsoleValues(values));
    }

    var shadowed_consoleLog = console.log;

    console.log = function() {
        shadowed_consoleLog(...arguments);

        logConsoleValues("log", [...arguments]);
    };

    console.info = console.log;

    var shadowed_consoleWarn = console.warn;

    console.warn = function() {
        shadowed_consoleWarn(...arguments);

        logConsoleValues("warning", [...arguments]);
    };

    var shadowed_consoleError = console.error;

    console.error = function() {
        shadowed_consoleError(...arguments);

        logConsoleValues("error", [...arguments]);
    };

    window.addEventListener("error", function(event) {
        logConsoleValues("error", [event.error.stack]);
    });

    Object.defineProperty(window, "_investigator_consoleReturn", {
        value: Object.freeze(function(call) {
            var value = null;

            try {
                value = call();
    
                logConsoleValues("return", [value]);
            } catch (e) {
                logConsoleValues("error", [e instanceof Error ? `${e.constructor.name}: ${e.message}` : e]);
            }
    
            return value;
        }),
        writable: false
    });

    Object.defineProperty(window, "_investigator_serialiseValue", {
        value: Object.freeze(function serialiseValue(value, path = [], summary = false) {
            while (path.length > 0) {
                if (value instanceof Object) {
                    value = value[path[0]];
                } else {
                    return null;
                }

                path.shift();
            }

            if (Array.isArray(value)) {
                if (summary) {
                    return {type: "array", length: value.length, summary: true};
                }

                return {
                    type: "array",
                    length: value.length,
                    items: value.map((item) => serialiseValue(item, [], true))
                };
            }

            if (value instanceof Object) {
                var constructorName = value.constructor != Object ? value.constructor.name : null;

                if (summary) {
                    return {type: "object", constructorName, summary: true};
                }

                var items = {};

                Object.keys(value).forEach(function(key) {
                    items[key] = serialiseValue(value[key], [], true);
                });

                return {
                    type: "object",
                    constructorName,
                    items
                };
            }

            return {type: "value", value};
        }),
        writable: false
    });
}

function investigatorEvent(event) {
    if (!investigatorListeningEventTypes[event.type]) {
        return;
    }

    electron.ipcRenderer.sendToHost("investigator_event", event);
}

function investigatorCommand(command, data = {}) {
    if (command == "evaluate") {
        var escapedCode = data.code
            .replace(/\\/g, "\\\\")
            .replace(/\`/g, "\\`")
        ;

        if (escapedCode.startsWith("{")) {
            escapedCode = `(${escapedCode})`;
        }

        return Promise.resolve(electron.webFrame.executeJavaScript(`window._investigator_consoleReturn(() => window.eval(\`${escapedCode}\`));`));
    }

    if (command == "getConsoleLogs") {
        electron.webFrame.executeJavaScript("window._investigator_consoleValues ||= [];");

        return Promise.resolve(investigatorConsoleLogs);
    }

    if (command == "getConsoleValues") {
        return Promise.resolve(electron.webFrame.executeJavaScript(
            `window._investigator_consoleValues[${Number(data.valueStorageId)}].map((value) =>` +
                `window._investigator_serialiseValue(value)` +
            `);`
        ));
    }

    if (command == "expandConsoleValue") {
        return Promise.resolve(electron.webFrame.executeJavaScript(
            `window._investigator_serialiseValue(value,` +
                `window._investigator_consoleValues[${Number(data.valueStorageId)}][${Number(data.index)}],` +
                JSON.stringify(data.path || []) +
            `);`
        ));
    }

    if (command == "listenToEvent") {
        if (data.eventType == "consoleLogAdded") {
            electron.webFrame.executeJavaScript("window._investigator_consoleValues ||= [];");

            investigatorListeningEventTypes[data.eventType] = true;

            return Promise.resolve();
        }

        return Promise.reject({
            code: "invalidEventType",
            message: "The event type to listen to is invalid."
        });
    }

    return Promise.reject({
        code: "invalidCommand",
        message: "The requested command is invalid."
    });
}

electron.contextBridge.exposeInMainWorld("_sphere", {
    isSystemApp: function() {
        return window.location.href.startsWith("gshell://");
    },
    isPrivileged: function() {
        return isPrivileged;
    },
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
    },
    onPrivilegedDataEvent: function(eventType, callback) {
        privilegedDataEventListeners.push({eventType, callback});
    },
    waitForPrivilegedDataAccess: function(callback) {
        if (privilegedDataUpdated) {
            callback();

            return;
        }

        privilegedDataAccessWaitQueue.push(callback);
    },
    permissions_setSelectUsbDeviceFilters: function(filters) {
        electron.ipcRenderer.sendToHost("permissions_setSelectUsbDeviceFilters", filters);
    },
    investigator_consoleLog: function(level, values, valueStorageId) {
        investigatorConsoleLogs.push({level, values, valueStorageId});

        investigatorEvent({
            type: "consoleLogAdded",
            level,
            values,
            valueStorageId
        });
    }
});

electron.webFrame.executeJavaScript(`(${userAgent.toString()})();`);

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
            if (!isTextualInput(event.target) || event.target.matches(":disabled")) {
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

    window.addEventListener("mousedown", function(event) {
        if (!event.target.matches("select")) {
            return;
        }

        event.preventDefault();

        openSelect(event.target);
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

    window.addEventListener("focusin", function(event) {
        if (!mainState.a11y_options?.switch_enabled && isTextualInput(event.target) && !event.target.matches(":disabled") && !shouldSkipNextInputShow) {
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
            !event.target.matches(":disabled") &&
            mainState.a11y_options?.switch_enabled &&
            !mainState.input_showing
        ) {
            event.preventDefault();

            electron.ipcRenderer.sendToHost("input_show");
        }

        if ([" ", "Enter"].includes(event.key) && event.target.matches("select")) {
            event.preventDefault();

            openSelect(event.target);
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

        isPrivileged = data.isPrivileged;

        if (isPrivileged) {
            privilegedDataUpdateCallbacks.forEach((callback) => callback(data.privilegedData));
        } else {
            mainState.privilegedData = null;
        }

        privilegedDataUpdated = true;

        privilegedDataAccessWaitQueue.forEach((callback) => callback());

        privilegedDataAccessWaitQueue = [];
    });

    electron.ipcRenderer.on("callback", function(event, data) {
        privilegedDataResponseQueue[data.id] = data;
    });

    electron.ipcRenderer.on("openFrame", function(event, data) {
        electron.ipcRenderer.sendToHost("openFrame", data);
    });

    electron.ipcRenderer.on("investigator_command", function(event, data) {
        investigatorCommand(data.command, data.data).then(function(response) {
            electron.ipcRenderer.sendToHost("investigator_response", {
                id: data.id,
                type: "success",
                response
            });
        }).catch(function(response) {
            electron.ipcRenderer.sendToHost("investigator_response", {
                id: data.id,
                type: "error",
                response
            });
        });
    });

    electron.ipcRenderer.on("input_scrollIntoView", function() {
        document.activeElement.scrollIntoView({block: "nearest", inline: "nearest"});
    });

    electron.ipcRenderer.on("select_confirmOption", function(event, data) {
        currentSelectElement.value = data.value;

        currentSelectElement.dispatchEvent(new CustomEvent("change"));
    });

    electron.ipcRenderer.on("investigator_event", function(event, data) {
        triggerPrivilegedDataEvent("investigator_event", data);
    });

    electron.ipcRenderer.on("term_read", function(event, data) {
        triggerPrivilegedDataEvent("term_read", data);
    });

    electron.ipcRenderer.on("term_exit", function(event, data) {
        triggerPrivilegedDataEvent("term_exit", data);
    });

    electron.ipcRenderer.sendToHost("ready");
});