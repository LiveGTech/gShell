/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export var keyboardLayouts = [];
export var currentKeyboardLayout = null;

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

                    while (row.length > 0) {
                        if (matchesToken("{.*?}")) {
                            var args = nextToken.substring(1, nextToken.length - 1).split(":");
                            var keyType = args.shift();
                            var key = $g.create("button");

                            switch (keyType) {
                                case ".shift":
                                    key.setText("^"); // TODO: Add icon

                                    key.on("click", function() {
                                        thisScope.toggleShift();
                                    });
    

                                    break;

                                case ".backspace":
                                    key.setText("Bksp"); // TODO: Add icon

                                    // TODO: Implement key press events

                                    break;

                                case ".space":
                                    key.setText("____"); // TODO: Add icon

                                    // TODO: Implement key press events

                                    break;

                                case ".enter":
                                    key.setText("Enter"); // TODO: Add icon

                                    // TODO: Implement key press events

                                    break;

                                case "":
                                    key = $g.create("span");

                                    break;

                                default:
                                    key.setText(keyType);

                                    var targetState = args.shift();

                                    key.on("click", function() {
                                        thisScope.currentState = targetState;

                                        thisScope.onStateUpdate();
                                    });
                            }

                            key.setStyle("width", `${(Number(args.shift()) || 1) * 100}%`);

                            rowElement.add(key);

                            continue;
                        }

                        if (matchesToken("{\\.shift}")) {
                            rowElement.add(
                                $g.create("button")
                                    .setText("^") // TODO: Properly implement
                                    .on("click", function() {
                                        thisScope.toggleShift();
                                    })
                            );

                            continue;
                        }

                        if (matchesToken("{\\.backspace}")) {
                            rowElement.add(
                                $g.create("button")
                                    .setText("Bksp") // TODO: Properly implement
                            );

                            continue;
                        }

                        if (matchesToken("{\\.space}")) {
                            rowElement.add(
                                $g.create("button")
                                    .setText("___") // TODO: Properly implement
                            );

                            continue;
                        }

                        if (matchesToken("{\\.enter}")) {
                            rowElement.add(
                                $g.create("button")
                                    .setText("Enter") // TODO: Properly implement
                            );

                            continue;
                        }

                        matchesToken(".");

                        rowElement.add(
                            $g.create("button")
                                .setText(nextToken)
                        );
                    }

                    return rowElement;
                })
            )
        ;
    }
}

export function init() {
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
            $g.create("button").setText("Hide").on("click", hide)
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