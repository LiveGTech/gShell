/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as aui_a11y from "gshell://lib/adaptui/src/a11y.js";

import * as a11y from "gshell://a11y/a11y.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

// Also in `shell/webviewpreload.js`
export const NON_TEXTUAL_INPUTS = [
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

export var keyboardLayouts = [];
export var currentKeyboardLayout = null;
export var showing = false;
export var targetInputSurface = null;

var targetInput = null;
var showingTransition = false;
var lastInputScrollLeft = 0;

export class KeyboardLayout {
    constructor(localeCode, variant) {
        this.localeCode = localeCode;
        this.variant = variant;

        this.metadata = {};
        this.states = {};
        this.defaultState = null;
        this.shiftState = null;
        this.currentState = null;
        this.capsLockActive = false;
    }

    static deserialise(data) {
        var instance = new this(data.localeCode, data.variant);

        instance.metadata = data.metadata || {};
        instance.states = data.states || {};
        instance.defaultState = data.defaultState || null;
        instance.shiftState = data.shiftState || null;
        instance.currentState = instance.defaultState;

        return instance;
    }

    get shiftActive() {
        return this.currentState == this.shiftState;
    }

    set shiftActive(value) {
        this.currentState = value ? this.shiftState : this.defaultState;
    }

    toggleShift(includeCapsLock = false) {
        if (includeCapsLock && this.shiftActive && !this.capsLockActive) {
            this.capsLockActive = true;
        } else {
            this.shiftActive = !this.shiftActive;
            this.capsLockActive = false;
        }

        this.onStateUpdate();
    }

    returnToTargetInput(returnToKeyWhenSwitchEnabled = false) {
        var lastInputFocus = $g.sel(document.activeElement);

        targetInput?.focus();

        if (a11y.options.switch_enabled) {
            setTimeout(function() {
                $g.sel(document.activeElement).blur();

                if (returnToKeyWhenSwitchEnabled) {
                    lastInputFocus.focus();
                } else {
                    $g.sel(".input").find(aui_a11y.FOCUSABLES).first().focus();
                }
            }, 100);
        }
    }

    onStateUpdate() {}

    render() {
        var thisScope = this;

        return $g.create("div")
            .addClass("input_keyboard_keys")
            .add(
                ...(this.states[this.currentState] || []).map(function(row) {
                    var rowElement = $g.create("div").addClass("input_keyboard_row");
                    var nextToken = "";

                    function matchesToken(token) {
                        var matches = row.match(new RegExp(`^(?:${token})`));

                        if (matches) {
                            nextToken = matches[0];
                            row = row.substring(matches[0].length);

                            return true;
                        }

                        return false;
                    }

                    function keyEventFactory(keyCode, modifiers = [], interpretShift = false) {
                        if (interpretShift && keyCode.toUpperCase() == keyCode) {
                            modifiers.push("Shift");
                        }

                        return function() {
                            var webContentsId = getWebContentsId();

                            ["keyDown", "char", "keyUp"].forEach(function(type) {
                                if (type == "char" && ["Enter"].includes(keyCode)) {
                                    return;
                                }

                                gShell.call("io_input", {webContentsId, event: {type, keyCode, modifiers}});
                            });

                            if (thisScope.shiftActive && !thisScope.capsLockActive) {
                                thisScope.shiftActive = false;

                                thisScope.onStateUpdate();
                            }
                        };
                    }

                    while (row.length > 0) {
                        var key = $g.create("button");

                        function setKeyAction(callback, returnToKeyWhenSwitchEnabled) {
                            key.on("click", function(event) {
                                if (!a11y.options.switch_enabled) {
                                    targetInput?.focus();
                                }

                                callback(event);

                                thisScope.returnToTargetInput(returnToKeyWhenSwitchEnabled);
                            });
                        }

                        if (matchesToken("{\\.lm}")) {
                            key.addClass("input_keyboard_landmark");

                            (function(key) {
                                function getLandmarkedKeys() {
                                    var landmarkedKeys = [];
                                    var currentLandmarkedKey = key;
    
                                    do {
                                        currentLandmarkedKey = currentLandmarkedKey.next("button");
    
                                        landmarkedKeys.push(currentLandmarkedKey);
                                    } while (currentLandmarkedKey.getAll().length > 0 && currentLandmarkedKey.is("button:not(.input_keyboard_landmark"))

                                    landmarkedKeys.pop(); // The next landmark
    
                                    return landmarkedKeys;
                                }
    
                                key.on("focus", function() {
                                    var landmarkedKeys = getLandmarkedKeys();
    
                                    if (landmarkedKeys.length == 0) {
                                        return;
                                    }
    
                                    var originRect = rowElement.get().getBoundingClientRect();
                                    var firstLandmarkedKeyRect = landmarkedKeys[0].get().getBoundingClientRect();
                                    var lastLandmarkedKeyRect = landmarkedKeys[landmarkedKeys.length - 1].get().getBoundingClientRect();
    
                                    key.setStyle("top", `${firstLandmarkedKeyRect.top - originRect.top}px`);
                                    key.setStyle("left", `${firstLandmarkedKeyRect.left - originRect.left}px`);
                                    key.setStyle("width", `${lastLandmarkedKeyRect.right - firstLandmarkedKeyRect.left}px`);
                                    key.setStyle("height", `${lastLandmarkedKeyRect.bottom - firstLandmarkedKeyRect.top}px`);

                                    landmarkedKeys.forEach((key) => key.setAttribute("tabindex", "-1"));
                                });

                                key.on("click", function() {
                                    var landmarkedKeys = getLandmarkedKeys();

                                    landmarkedKeys.forEach((key) => key.removeAttribute("tabindex"));

                                    landmarkedKeys[0]?.focus();
                                });
                            })(key);

                            rowElement.add(key);

                            continue;
                        }

                        if (matchesToken("{.*?}")) {
                            var args = nextToken.substring(1, nextToken.length - 1).split(":");
                            var keyType = args.shift();

                            switch (keyType) {
                                case ".shift":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark embedded")
                                            .setAttribute("src", 
                                                thisScope.capsLockActive ?
                                                "gshell://lib/adaptui/icons/key-capslock.svg" :
                                                "gshell://lib/adaptui/icons/key-shift.svg"
                                            )
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_shift"));

                                    setKeyAction(function() {
                                        thisScope.toggleShift(true);
                                    });

                                    break;

                                case ".backspace":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark embedded")
                                            .setAttribute("src", "gshell://lib/adaptui/icons/key-backspace.svg")
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_backspace"));

                                    setKeyAction(keyEventFactory("Backspace"), true);

                                    break;

                                case ".space":
                                    key.addClass("input_keyboard_spaceKey");

                                    key.add($g.create("div"));

                                    key.setAttribute("aria-label", _("input_key_space"));

                                    setKeyAction(keyEventFactory(" "));

                                    break;

                                case ".enter":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark embedded")
                                            .setAttribute("src", "gshell://lib/adaptui/icons/key-enter.svg")
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_enter"));

                                    setKeyAction(keyEventFactory("Enter"));

                                    break;

                                case "":
                                    key = $g.create("span");

                                    break;

                                case ".u":
                                    keyType = String.fromCodePoint(args.shift().split(",").map((codePoint) => parseInt(codePoint, 16)));

                                    // Continue to default behaviour since Unicode string has been assembled

                                default:
                                    key.setText(keyType);

                                    (function(targetAction) {
                                        setKeyAction(function(event) {
                                            if (targetAction.startsWith("@")) {
                                                thisScope.currentState = targetAction.substring(1);
    
                                                thisScope.onStateUpdate();
    
                                                return;
                                            }
    
                                            keyEventFactory(targetAction, [], true)(event);
                                        });
                                    })(args.shift() || keyType);

                                    break;
                            }

                            key.setStyle("width", `${(Number(args.shift()) || 1) * 100}%`);

                            rowElement.add(key);

                            continue;
                        }

                        matchesToken(".");

                        setKeyAction(keyEventFactory(nextToken, [], true));

                        rowElement.add(
                            key.setText(nextToken)
                        );
                    }

                    return rowElement;
                })
            )
        ;
    }
}

export function init() {
    setInterval(function() {
        lastInputScrollLeft = document.activeElement.scrollLeft;

        if (document.activeElement?.matches(".input, .input *")) {
            return;
        }

        targetInputSurface = document.activeElement;
    });

    $g.sel("body").on("click", function(event) {
        if (a11y.options.switch_enabled) {
            return;
        }

        if (!event.target.matches("body *")) { // Elements removed from DOM won't match to `.input *` etc.
            return;
        }

        if (event.target.matches("label, .input, .input *, [inputmode='none']")) { // TODO: Support `inputmode` and not just `type`
            return;
        }

        if (event.target.matches("input")) {
            if (!isTextualInput($g.sel(event.target))) {
                hide();

                return;
            }

            event.target.focus();

            show();

            return;
        }

        hide();

        return;
    });

    $g.sel("body").on("focusout", function(event) {
        if (isTextualInput($g.sel(event.target))) {
            event.target.scrollLeft = lastInputScrollLeft;
        }
    });

    $g.sel("body").on("click", function(event) {
        if (isTextualInput($g.sel(event.target)) && a11y.options.switch_enabled) {
            event.target.focus();

            setTimeout(function() {
                show();
            });
        }
    });

    $g.sel(".input").on("click", function(event) {
        if (event.target.matches("button")) {
            return;
        }

        targetInputSurface?.focus();

        event.preventDefault();
    });

    fetch("gshell://input/layouts/en_GB_qwerty.gkbl").then(function(response) {
        return response.json();
    }).then(function(data) {
        var keyboard = KeyboardLayout.deserialise(data);

        keyboard.onStateUpdate = function() {
            render();

            $g.sel(".input").find(aui_a11y.FOCUSABLES).first().focus();
        };

        keyboardLayouts.push(keyboard);

        if (currentKeyboardLayout == null) {
            currentKeyboardLayout = keyboard;
        }

        render();
    });
}

export function getWebContentsId() {
    var webContentsId = 1;

    if (targetInputSurface.matches("webview")) {
        webContentsId = targetInputSurface.getWebContentsId();
    }

    return webContentsId;
}

export function isTextualInput(element) {
    return element.is("input") && !(NON_TEXTUAL_INPUTS.includes(String(element.getAttribute("type") || "").toLowerCase()));
}

export function removeTargetInput() {
    targetInput = null;
}

export function render() {
    $g.sel(".input")
        .clear()
        .add(
            $g.create("div").setStyle("height", "2.5rem"),
            currentKeyboardLayout.render(),
            $g.create("div")
                .addClass("input_keyboard_row")
                .addClass("input_keyboard_options")
                .add(
                    $g.create("button")
                        .addClass("input_keyboard_iconKey")
                        .setAttribute("title", _("input_option_hide"))
                        .setAttribute("aria-label", _("input_option_hide"))
                        .on("click", hide)
                        .add(
                            $g.create("img")
                                .setAttribute("aui-icon", "dark embedded")
                                .setAttribute("src", "gshell://lib/adaptui/icons/hidekeyboard.svg")
                                .setAttribute("alt", "")
                        )
                    ,
                    $g.create("button") // TODO: Implement emoji
                        .addClass("input_keyboard_iconKey")
                        .setAttribute("title", _("input_option_emoji"))
                        .setAttribute("aria-label", _("input_option_emoji"))
                        .add(
                            $g.create("img")
                                .setAttribute("aui-icon", "dark embedded")
                                .setAttribute("src", "gshell://lib/adaptui/icons/emoji.svg")
                                .setAttribute("alt", "")
                        )
                )
        )
    ;
}

export function show() {
    targetInput = document.activeElement;

    showing = true;
    showingTransition = true;

    $g.sel("body").addClass("input_keyboardShowing");

    webviewComms.update();

    if (a11y.options.switch_enabled) {
        a11y.assistiveTechnologies.filter((tech) => tech instanceof a11y.modules.switch?.SwitchNavigation).forEach(function(tech) {
            tech.startItemScan();
        });

        $g.sel(".input").removeAttribute("hidden");

        $g.sel(".input").find(aui_a11y.FOCUSABLES).first().focus();

        aui_a11y.setFocusTrap($g.sel(".input").get());
    }

    return Promise.all([
        $g.sel(".input").fadeIn(250),
        $g.sel(".input").easeStyleTransition("bottom", 0, 250)
    ]).then(function() {
        showingTransition = false;

        if (targetInputSurface?.matches("webview")) {
            targetInputSurface.send("input_scrollIntoView");
        } else {
            targetInput.scrollIntoView({block: "nearest", inline: "nearest"});
        }
    });
}

export function hide(force = false) {
    if (!force && showingTransition) {
        return;
    }

    aui_a11y.clearFocusTrap();

    showing = false;

    targetInput?.focus();

    if (targetInput?.matches("input")) {
        targetInput.scrollLeft = 0;
    }

    targetInput = null;

    $g.sel("body").removeClass("input_keyboardShowing");

    webviewComms.update();

    return Promise.all([
        $g.sel(".input").fadeOut(250),
        $g.sel(".input").easeStyleTransition("bottom", -20, 250)
    ]).then(function() {
        if (showingTransition) {
            $g.sel(".input").show();
        }
    });
}