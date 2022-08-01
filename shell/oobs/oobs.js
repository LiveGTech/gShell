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
import * as sizeUnits from "gshell://common/sizeunits.js";

var installDisks = [];

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

    var flags;

    gShell.call("system_getFlags").then(function(result) {
        flags = result;

        return gShell.call("system_isInstallationMedia");
    }).then(function(isInstallationMedia) {
        $g.sel("button[oobs-choosestep]").getAll().forEach(function(element) {
            element = $g.sel(element);
    
            element.on("click", function() {
                if (isInstallationMedia && element.hasAttribute("oobs-choosestepim")) {
                    selectStep(element.getAttribute("oobs-choosestepim"));
                } else {
                    selectStep(element.getAttribute("oobs-choosestep"));
                }
            });
        });

        if (isInstallationMedia) {
            gShell.call("system_executeCommand", {
                command: "lsblk",
                args: ["-db", "-o", "NAME,RO,SIZE,LABEL"]
            }).then(function(output) {
                var lines = (output.stdin || "").split("\n").filter((line) => line != "");

                lines.shift();

                installDisks = (flags.isRealHardware ? lines.map(function(line, i) {
                    var parts = line.split(" ").filter((part) => part != "");

                    return {
                        number: i + 1,
                        name: parts[0],
                        readOnly: parts[1] == 1,
                        size: Number(parts[2]),
                        label: parts.slice(3).join(" ")
                    };
                }) : [
                    {number: 1, name: "sda", readOnly: 0, size: 1_024 ** 3, label: "Dummy disk"},
                    {number: 2, name: "sdb", readOnly: 0, size: 1_024 ** 3, label: ""}
                ]).filter((disk) => !["sr0", "fd0"].includes(disk.name) && !disk.readOnly);

                $g.sel(".oobs_installDisks").clear().add(
                    ...installDisks.map((disk) => $g.create("div").add(
                        $g.create("input")
                            .setId(`oobs_installDisks_${disk.name}`)
                            .setAttribute("type", "radio")
                            .setAttribute("name", "oobs_installDisks")
                            .setAttribute("value", disk.name)
                        ,
                        $g.create("label")
                            .setAttribute("for", `oobs_installDisks_${disk.name}`)
                            .add(
                                $g.create("strong").setText(
                                    disk.label == "" ?
                                    _("oobs_installDisks_diskUnlabelledTitle", {...disk}) :
                                    _("oobs_installDisks_diskLabelledTitle", {...disk})
                                ),
                                $g.create("br"),
                                $g.create("span").setText(_("oobs_installDisks_diskTotalSize", {
                                    size: sizeUnits.getString(Number(disk.size))
                                }))
                            )
                    ))
                );
            })
        }
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