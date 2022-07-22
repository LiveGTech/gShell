/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as a11y from "gshell://lib/adaptui/src/a11y.js";

import * as users from "gshell://config/users.js";
import * as auth from "gshell://auth/auth.js";
import * as lockScreen from "gshell://auth/lockscreen.js";

export function selectStep(stepName) {
    return $g.sel(`#oobs .oobs_step:not([aui-template="gshell://oobs/${stepName}.html"])`).fadeOut().then(function() {
        return $g.sel(`#oobs .oobs_step[aui-template="gshell://oobs/${stepName}.html"]`).fadeIn();
    }).then(function() {
        $g.sel($g.sel(`#oobs .oobs_step:not([hidden])`).find(a11y.FOCUSABLES).getAll()[0]).focus();
    });
}

export function finish() {
    var credentials;

    $g.sel("#oobs").fadeOut(1_000).then(function() {
        return users.create(undefined, {
            displayName: $g.sel("#oobs_userProfile_displayName").getValue().trim()
        });
    }).then(function(user) {
        credentials = new auth.UserAuthCredentials(user);

        return auth.UnsecureAuthMethod.generate();
    }).then(function(method) {
        credentials.authMethods.push(method);

        return credentials.save();
    }).then(function() {
        return lockScreen.loadUsers();
    }).then(function() {
        $g.sel("#lockScreenMain").screenFade();
    });
}

function checkDisplayName() {
    if ($g.sel("#oobs_userProfile_displayName").getValue().trim() == "") {
        $g.sel(".oobs_userProfile_error").setText(_("oobs_userProfile_displayNameEmptyError"));

        return;
    }

    if ($g.sel("#oobs_userProfile_displayName").getValue().trim().length > 1_000) {
        $g.sel(".oobs_userProfile_error").setText(_("oobs_userProfile_displayNameLengthError"));

        return;
    }

    $g.sel(".oobs_userProfile_error").setText("");

    selectStep("finish");
}

export function init() {
    selectStep("welcome");

    $g.sel("button[oobs-choosestep]").getAll().forEach(function(element) {
        element = $g.sel(element);

        element.on("click", function() {
            selectStep(element.getAttribute("oobs-choosestep"));
        });
    });

    $g.sel(".oobs_finish").on("click", function() {
        finish();
    });

    $g.sel(".oobs_userProfile_next").on("click", function() {
        checkDisplayName();
    });

    $g.sel("#oobs_userProfile_displayName").on("keydown", function(event) {
        if (event.key == "Enter") {
            checkDisplayName();
        }
    });
}