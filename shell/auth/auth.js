/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";

export function build() {
    var delButtonHoldStart = null;

    $g.sel(".lockScreen_auth").clear();

    $g.sel(".lockScreen_auth").add(
        $g.create("p").setText(_("lockScreen_enterPasscode")),
        $g.create("div").add(
            $g.create("input")
                .addClass("lockScreen_auth_passcode")
                .setAttribute("type", "password")
                .setAttribute("dir", "ltr") // Passcode inputs are always LTR independent of locale
                .setAttribute("aria-label", _("lockScreen_enterPasscode"))
                .on("keydown", function(event) {
                    if (event.key == "Enter") {
                        $g.sel("#main").screenFade().then(function() {
                            $g.sel(".lockScreen_auth_passcode").setValue("");
                        });
                    }
                })
        ),
        $g.create("div").addClass("lockScreen_auth_passcodeButtons").add(
            ...[
                [1, 2, 3], [4, 5, 6], [7, 8, 9], ["del", 0, "enter"]
            ].map((row) => $g.create("aui-buttons")
                .setAttribute("dir", "ltr")
                .add(...row.map((button) => $g.create("button")
                    .choose(button,
                        "del", ($) => $
                            .addClass("lockScreen_auth_passcodeButtons_del")
                            .add(
                                $g.create("img")
                                    .setAttribute("src", "gshell://lib/adaptui/icons/back.svg")
                                    .setAttribute("aui-icon", "light")
                                    .setAttribute("alt", "")
                            )
                            .setAttribute("title", _("lockScreen_delete"))
                            .setAttribute("aria-label", _("lockScreen_delete"))
                            .on("mousedown touchstart", function() {
                                delButtonHoldStart = Date.now();
                            })
                            .on("mouseup touchend", function(event) {
                                if (delButtonHoldStart != null && Date.now() - delButtonHoldStart >= a11y.holdDelay) {
                                    cancel();
                                }
                            })
                        ,
                        "enter", ($) => $
                            .addClass("lockScreen_auth_passcodeButtons_enter")
                            .add(
                                $g.create("img")
                                    .setAttribute("src", "gshell://lib/adaptui/icons/checkmark.svg")
                                    .setAttribute("aui-icon", "light")
                                    .setAttribute("alt", "")
                            )
                            .setAttribute("title", _("lockScreen_unlock"))
                            .setAttribute("aria-label", _("lockScreen_unlock"))
                        ,
                        ($) => $.setText(_format(button))
                    )
                    .on("click", function() {
                        var input = $g.sel(".lockScreen_auth_passcode").get();
                        var currentPasscode = $g.sel(".lockScreen_auth_passcode").getValue();
                        var selectionStart = input.selectionStart;
                        var selectionEnd = input.selectionEnd;

                        if (button == "del") {
                            if (currentPasscode.length == 0) {
                                cancel();

                                return;
                            }

                            if (selectionStart == 0 && selectionEnd == 0) {
                                $g.sel(".lockScreen_auth_passcode").focus();

                                input.selectionStart = selectionStart;
                                input.selectionEnd = input.selectionStart;

                                return;
                            }

                            $g.sel(".lockScreen_auth_passcode").setValue(currentPasscode.substring(0, selectionStart == selectionEnd ? selectionStart - 1 : selectionStart) + currentPasscode.substring(selectionEnd));
                            $g.sel(".lockScreen_auth_passcode").focus();

                            input.selectionStart = selectionStart == selectionEnd ? selectionStart - 1 : selectionStart;
                            input.selectionEnd = input.selectionStart;

                            if ($g.sel(".lockScreen_auth_passcode").getValue().length == 0) {
                                $g.sel(".lockScreen_auth_passcodeButtons_del img").setAttribute("src", "gshell://lib/adaptui/icons/back.svg");
                            }

                            return;
                        }

                        if (button == "enter") {
                            unlock();

                            return;
                        }

                        $g.sel(".lockScreen_auth_passcode").setValue(currentPasscode.substring(0, selectionStart) + String(button) + currentPasscode.substring(selectionEnd));
                        $g.sel(".lockScreen_auth_passcode").focus();

                        input.selectionStart = selectionStart + 1;
                        input.selectionEnd = input.selectionStart;

                        $g.sel(".lockScreen_auth_passcodeButtons_del img").setAttribute("src", "gshell://lib/adaptui/icons/backspace.svg");
                    })
                )
            ))
        )
    );
}

export function start() {
    build();

    return $g.sel("#lockScreenAuth").screenFade().then(function() {
        $g.sel(".lockScreen_auth_passcode").focus();

        return Promise.resolve();
    });
}

export function unlock() {
    // TODO: Check passcode is correct

    $g.sel("#main").screenFade().then(function() {
        $g.sel(".lockScreen_auth_passcode").setValue("");
    });
}

export function cancel() {
    $g.sel("#lockScreenMain").screenFade().then(function() {
        $g.sel(".lockScreen_auth_passcode").setValue("");
    });
}