/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as users from "gshell://config/users.js";
import * as network from "gshell://system/network.js";

export function applyDateTime() {
    $g.sel(".info_date").setText(_format(new Date(), {weekday: "long", day: "numeric", month: "long"}));
    $g.sel(".info_time").setText(_format(new Date(), {timeStyle: "short"}));
}

export function applyPower() {
    gShell.call("power_getState").then(function(response) {
        if (response.state == null) {
            $g.sel(".info_batteryLevel").setText("");

            $g.sel(".info_batteryIcon").hide();

            $g.sel(".info_batteryIcon").setAttribute("src", "gshell://lib/adaptui/icons/battery-unknown.svg");
            $g.sel(".info_batteryIcon").setAttribute("alt", _("info_batteryIcon_unknown"));
            $g.sel(".info_batteryIcon").setAttribute("title", _("info_batteryIcon_unknown"));

            return;
        }

        $g.sel(".info_batteryLevel").setText(_("percentage", {value: response.level}));

        $g.sel(".info_batteryIcon").show();

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

export function applyNetwork() {
    var genericConnections = network.listResults.filter((result) => result.connected);
    var wifiScanConnectedResults = network.wifiScanResults.filter((result) => result.connected);

    if (genericConnections.find((result) => result.type == "wifi")) {
        var connectedAp = wifiScanConnectedResults[0];
        var alt = _("info_networkIcon_connectedWifi", {name: connectedAp.name, signal: connectedAp.signal});

        $g.sel(".info_networkIcon").setAttribute("src", `gshell://lib/adaptui/icons/wifi-${Math.round((connectedAp.signal / 100) * 2)}.svg`);
        $g.sel(".info_networkIcon").setAttribute("alt", alt);
        $g.sel(".info_networkIcon").setAttribute("title", alt);
    } else if (genericConnections.find((result) => result.type == "ethernet")) {
        $g.sel(".info_networkIcon").setAttribute("src", `gshell://lib/adaptui/icons/ethernet.svg`);
        $g.sel(".info_networkIcon").setAttribute("alt", _("info_networkIcon_connectedEthernet"));
        $g.sel(".info_networkIcon").setAttribute("title", _("info_networkIcon_connectedEthernet"));
    } else {
        $g.sel(".info_networkIcon").setAttribute("src", `gshell://lib/adaptui/icons/offline.svg`);
        $g.sel(".info_networkIcon").setAttribute("alt", _("info_networkIcon_disconnected"));
        $g.sel(".info_networkIcon").setAttribute("title", _("info_networkIcon_disconnected"));
    }
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
    applyNetwork();
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

    users.onUserStateChange(function(user) {
        applyCurrentUser();
    });
}