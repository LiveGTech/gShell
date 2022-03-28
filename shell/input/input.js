/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export var keyboardLayouts = [];
export var currentKeyboardLayout = null;
export var targetInputSurface = null;

export class KeyboardLayout {
    constructor(localeCode, variant) {
        this.localeCode = localeCode;
        this.variant = variant;

        this.metadata = {};
        this.states = {};
        this.defaultState = null;
        this.shiftState = null;
        this.currentState = null;
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

    toggleShift() {
        this.shiftActive = !this.shiftActive;

        this.onStateUpdate();
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
                            var webContentsId = 1;

                            if (targetInputSurface.matches("webview")) {
                                webContentsId = targetInputSurface.getWebContentsId();
                            }

                            ["keyDown", "char", "keyUp"].forEach(function(type) {
                                gShell.call("io_input", {webContentsId, event: {type, keyCode, modifiers}});
                            });

                            targetInputSurface?.focus();
                        };
                    }

                    while (row.length > 0) {
                        var key = $g.create("button");

                        if (matchesToken("{.*?}")) {
                            var args = nextToken.substring(1, nextToken.length - 1).split(":");
                            var keyType = args.shift();

                            switch (keyType) {
                                case ".shift":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark")
                                            .setAttribute("src", "gshell://lib/adaptui/icons/key-shift.svg")
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_shift"));

                                    key.on("click", function() {
                                        thisScope.toggleShift();

                                        targetInputSurface?.focus();
                                    });

                                    break;

                                case ".backspace":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark")
                                            .setAttribute("src", "gshell://lib/adaptui/icons/key-backspace.svg")
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_backspace"));

                                    key.on("click", keyEventFactory("Backspace"));

                                    break;

                                case ".space":
                                    key.addClass("input_keyboard_spaceKey");

                                    key.add($g.create("div"));

                                    key.setAttribute("aria-label", _("input_key_space"));

                                    key.on("click", keyEventFactory(" "));

                                    break;

                                case ".enter":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark")
                                            .setAttribute("src", "gshell://lib/adaptui/icons/key-enter.svg")
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_enter"));

                                    key.on("click", keyEventFactory("\n"));

                                    break;

                                case "":
                                    key = $g.create("span");

                                    break;

                                default:
                                    key.setText(keyType);

                                    var targetAction = args.shift();

                                    key.on("click", function(event) {
                                        if (targetAction.startsWith("@")) {
                                            thisScope.currentState = targetAction.substring(1);

                                            thisScope.onStateUpdate();

                                            targetInputSurface?.focus();

                                            return;
                                        }

                                        keyEventFactory(targetAction, [], true)(event);
                                    });
                            }

                            key.setStyle("width", `${(Number(args.shift()) || 1) * 100}%`);

                            rowElement.add(key);

                            continue;
                        }

                        matchesToken(".");

                        rowElement.add(
                            key
                                .setText(nextToken)
                                .on("click", keyEventFactory(nextToken, [], true))
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
        if (document.activeElement?.matches(".input, .input *")) {
            return;
        }

        targetInputSurface = document.activeElement;
    });

    $g.sel(".input").on("mousedown", function(event) {
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
        };

        keyboardLayouts.push(keyboard);

        if (currentKeyboardLayout == null) {
            currentKeyboardLayout = keyboard;
        }

        render();
    });
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
                                .setAttribute("aui-icon", "dark")
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
                                .setAttribute("aui-icon", "dark")
                                .setAttribute("src", "gshell://lib/adaptui/icons/emoji.svg")
                                .setAttribute("alt", "")
                        )
                )
        )
    ;
}

export function show() {
    return Promise.all([
        $g.sel(".input").fadeIn(250),
        $g.sel(".input").easeStyleTransition("bottom", 0, 250)
    ]);
}

export function hide() {
    return Promise.all([
        $g.sel(".input").fadeOut(250),
        $g.sel(".input").easeStyleTransition("bottom", -20, 250)
    ]);
}