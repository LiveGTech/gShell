/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export function build() {
    $g.sel(".lockScreen_auth").clear();

    $g.sel(".lockScreen_auth").add(
        $g.create("div").add(
            $g.create("input")
                .addClass("lockScreen_auth_passcode")
                .setAttribute("type", "password")
                .setAttribute("aria-label", "Enter passcode") // TODO: Translate
        ),
        $g.create("div").addClass("lockScreen_auth_passcodeButtons").add(
            ...[
                [1, 2, 3], [4, 5, 6], [7, 8, 9], ["del", 0, "enter"]
            ].map((row) => $g.create("aui-buttons").add(
                ...row.map((button) => $g.create("button")
                    .setText(_format(button)) // Showing of "del" and "enter" is temporary atm
                    .on("click", function() {
                        var currentPasscode = $g.sel(".lockScreen_auth_passcode").getValue();

                        if (button == "del") {
                            $g.sel(".lockScreen_auth_passcode").setValue(currentPasscode.substring(0, currentPasscode.length - 1));

                            return;
                        }

                        if (button == "enter") {
                            $g.sel("#main").screenFade().then(function() {
                                $g.sel(".lockScreen_auth_passcode").setValue("");
                            });

                            return;
                        }

                        $g.sel(".lockScreen_auth_passcode").setValue(currentPasscode + String(button));
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