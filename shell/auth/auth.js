/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";
import * as info from "gshell://global/info.js";

export const DEFAULT_SALT_ROUNDS = 10;
export const UNAUTHENTICATED_TIMEOUT = 1_000; // 1 second, to mitigate brute-forcing authentication

export const authMethodTypes = {
    BASE: -1,
    UNSECURE: 0,
    PASSWORD: 1,
    PASSCODE: 2
};

export var currentUserAuthCredentials = null;

var userStateChangeCallbacks = [];

export class AuthMethod {
    constructor(type) {
        this.type = type;
    }

    verify() {
        return Promise.reject("Authentication verification method not implemented");
    }

    static generate() {
        return Promise.resolve(new this());
    }

    static deserialise(data) {
        switch (data.type) {
            case authMethodTypes.UNSECURE:
                return new UnsecureAuthMethod();

            case authMethodTypes.PASSWORD:
                return new PasswordAuthMethod(data.hash, data.saltRounds);

            case authMethodTypes.PASSCODE:
                return new PasscodeAuthMethod(data.hash, data.saltRounds);

            default:
                return new this(authMethodTypes.BASE);
        }
    }

    serialise() {
        return {type: this.type};
    }
}

export class UnsecureAuthMethod extends AuthMethod {
    constructor() {
        super(authMethodTypes.UNSECURE);
    }

    verify() {
        return Promise.resolve(true);
    }
}

export class PasswordAuthMethod extends AuthMethod {
    constructor(hash, saltRounds) {
        super(authMethodTypes.PASSWORD);

        this.hash = hash;
        this.saltRounds = saltRounds;
    }

    static generate(password, saltRounds = DEFAULT_SALT_ROUNDS) {
        var thisScope = this;

        return gShell.call("auth_bcryptHash", {data: password, saltRounds}).then(function(hash) {
            return Promise.resolve(new thisScope(hash, saltRounds));
        });
    }

    verify(password) {
        return gShell.call("auth_bcryptCompare", {data: password, hash: this.hash});
    }

    serialise() {
        return {...super.serialise(), hash: this.hash, saltRounds: this.saltRounds};
    }
}

export class PasscodeAuthMethod extends PasswordAuthMethod {
    constructor(hash, saltRounds) {
        super(hash, saltRounds);

        this.type = authMethodTypes.PASSCODE;
    }
}

export class UserAuthCredentials {
    constructor(user) {
        this.user = user;

        this.loaded = false;
        this.authMethods = [];
    }

    load() {
        var thisScope = this;

        return this.user.getAuthData().then(function(data) {
            thisScope.authMethods = (data.methods || []).map(function(methodData) {
                return AuthMethod.deserialise(methodData);
            });

            thisScope.loaded = true;

            return Promise.resolve();
        });
    }

    save() {
        return this.user.setAuthData({
            methods: this.authMethods.map((method) => method.serialise())
        });
    }
}

function showLockScreen(authMethod) {
    var delButtonHoldStart = null;

    function verify() {
        if ($g.sel(".lockScreen_auth_passcode").getValue() == "") {
            $g.sel(".lockScreen_auth_passcode").focus();

            return Promise.resolve();
        }

        var controls = $g.sel(".lockScreen_auth_passcode, .lockScreen_auth_passcodeButtons button");

        controls.addAttribute("disabled");

        return authMethod.verify($g.sel(".lockScreen_auth_passcode").getValue()).then(function(authenticated) {
            if (authenticated) {
                return unlock().then(function() {
                    controls.removeAttribute("disabled");

                    $g.sel(".lockScreen_auth_passcode").setValue("");

                    return Promise.resolve();
                });
            }

            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    controls.removeAttribute("disabled");

                    $g.sel(".lockScreen_auth_passcode").setValue("");
                    $g.sel(".lockScreen_auth_message").setText(_("lockScreen_incorrectPasscode"));
                    $g.sel(".lockScreen_auth_passcode").focus();

                    resolve();
                }, UNAUTHENTICATED_TIMEOUT);
            });
        });
    }

    $g.sel(".lockScreen_auth_container").clear();

    $g.sel(".lockScreen_auth_container").add(
        $g.create("p")
            .addClass("lockScreen_auth_message")
            .setText(_("lockScreen_enterPasscode"))
        ,
        $g.create("div").add(
            $g.create("input")
                .addClass("lockScreen_auth_passcode")
                .setAttribute("type", "password")
                .setAttribute("dir", "ltr") // Passcode inputs are always LTR independent of locale
                .setAttribute("inputmode", "none")
                .setAttribute("aria-label", _("lockScreen_enterPasscode"))
                .on("keydown", function(event) {
                    if (event.key == "Escape") {
                        cancel();

                        return;
                    }

                    if (event.key == "Enter") {
                        verify();

                        return;
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
                                if (delButtonHoldStart != null && Date.now() - delButtonHoldStart >= a11y.options.touch_holdDelay) {
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
                            verify();

                            return;
                        }

                        $g.sel(".lockScreen_auth_passcode").setValue(currentPasscode.substring(0, selectionStart) + String(button) + currentPasscode.substring(selectionEnd));
                        $g.sel(".lockScreen_auth_passcode").focus();

                        input.selectionStart = selectionStart + 1;
                        input.selectionEnd = input.selectionStart;

                        $g.sel(".lockScreen_auth_passcodeButtons_del img").setAttribute("src", "gshell://lib/adaptui/icons/key-backspace.svg");
                    })
                )
            ))
        )
    );

    return $g.sel("#lockScreenAuth").screenFade().then(function() {
        $g.sel(".lockScreen_auth_passcode").focus();

        return Promise.resolve();
    });
}

export function start(user) {
    currentUserAuthCredentials = new UserAuthCredentials(user);

    return currentUserAuthCredentials.load().then(function() {
        if (currentUserAuthCredentials.authMethods.length == 0) {
            return Promise.reject("No authentication methods are available");
        }

        var authMethod = currentUserAuthCredentials.authMethods[0]; // TODO: Allow switching between methods

        if (authMethod instanceof PasscodeAuthMethod) {
            return showLockScreen(authMethod);
        }

        return unlock().then(function() {
            userStateChangeCallbacks.forEach((callback) => callback(true));

            return Promise.resolve();
        });
    });
}

export function unlock() {
    return $g.sel("#main").screenFade();
}

export function cancel() {
    $g.sel("#lockScreenMain").screenFade().then(function() {
        $g.sel(".lockScreen_auth_passcode").setValue("");
    });
}

export function onUserStateChange(callback) {
    userStateChangeCallbacks.push(callback);
}