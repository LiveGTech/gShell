/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as users from "gshell://config/users.js";

export function applyDateTime() {
    $g.sel(".info_date").setText(_format(new Date(), {weekday: "long", day: "numeric", month: "long"}));
    $g.sel(".info_time").setText(_format(new Date(), {timeStyle: "short"}));
}

export function applyPower() {
    gShell.call("power_getState").then(function(response) {
        if (response.state == null) {
            $g.sel(".info_batteryLevel").setText("");

            $g.sel(".info_batteryIcon").setAttribute("src", "gshell://lib/adaptui/icons/battery-unknown.svg");
            $g.sel(".info_batteryIcon").setAttribute("alt", _("info_batteryIcon_unknown"));
            $g.sel(".info_batteryIcon").setAttribute("title", _("info_batteryIcon_unknown"));

            return;
        }

        $g.sel(".info_batteryLevel").setText(_("percentage", {value: response.level}));

        if (response.state == "charging") {
            $g.sel(".info_batteryIcon").setAttribute("src", "gshell://lib/adaptui/icons/battery-charging.svg");
        } else {
            $g.sel(".info_batteryIcon").setAttribute("src", `gshell://lib/adaptui/icons/battery-${Math.round((response.level / 100) * 7)}.svg`);
        }

        var alt = response.state == "charging" ? _("info_batteryIcon_charging") : _("info_batteryIcon_discharging");

        $g.sel(".info_batteryIcon").setAttribute("alt", alt);
        $g.sel(".info_batteryIcon").setAttribute("title", alt);
    });
}

export function applyCurrentUser() {
    users.getCurrentUser().then(function(user) {
        if (user == null) {
            $g.sel(".info_currentUserDisplayName").setText(_("unknown"));

            return;
        }

        $g.sel(".info_currentUserDisplayName").setText(user.displayName || _("unknown"));

        $g.sel(".info_currentUserProfilePicture").setAttribute("src", `storage://users/${user.uid}/profile.png`);
    });
}

export function applyAll() {
    applyDateTime();
    applyPower();
    applyCurrentUser();
}

export function init() {
    $g.sel(".info_currentUserProfilePicture").on("error", function(event) {
        $g.sel(event.target).setAttribute("src", "gshell://media/userdefault.svg");
    });

    applyAll();

    setInterval(function() {
        applyDateTime();
    });

    setInterval(function() {
        applyPower();
    }, 3_000);
}