/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export function build() {
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
                            .add(
                                $g.create("img")
                                    .setAttribute("src", "gshell://lib/adaptui/icons/backspace.svg")
                                    .setAttribute("aui-icon", "light")
                                    .setAttribute("alt", "")
                            )
                            .setAttribute("title", _("lockScreen_delete"))
                            .setAttribute("aria-label", _("lockScreen_delete"))
                        ,
                        "enter", ($) => $
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

                            return;
                        }

                        if (button == "enter") {
                            $g.sel("#main").screenFade().then(function() {
                                $g.sel(".lockScreen_auth_passcode").setValue("");
                            });

                            return;
                        }

                        $g.sel(".lockScreen_auth_passcode").setValue(currentPasscode.substring(0, selectionStart) + String(button) + currentPasscode.substring(selectionEnd));
                        $g.sel(".lockScreen_auth_passcode").focus();

                        input.selectionStart = selectionStart + 1;
                        input.selectionEnd = input.selectionStart;
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