/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

astronaut.unpack();

import * as protocol from "./protocol.js";
import * as console from "./console.js";

const HEARTBEAT_INTERVAL = 1_000; // 3 seconds

$g.waitForLoad().then(function() {
    return $g.l10n.selectLocaleFromResources({
        "en_GB": "locales/en_GB.json",
        "fr_FR": "locales/fr_FR.json"
    }, "en_GB", {
        "fr_FR": "en_GB"
    });
}).then(function(locale) {
    window._ = function() {
        return locale.translate(...arguments);
    };

    window._format = function() {
        return locale.format(...arguments);
    };

    protocol.on("reload", function() {
        window.location.reload();
    });

    $g.sel("title").setText(_("webInvestigator"));

    $g.theme.setProperty("primaryHue", "140");
    $g.theme.setProperty("primarySaturation", "75%");
    $g.theme.setProperty("primaryLightness", "25%");

    $g.theme.setProperty("secondaryHue", "140");
    $g.theme.setProperty("secondarySaturation", "75%");
    $g.theme.setProperty("secondaryLightness", "40%");

    $g.theme.setProperty("dark-primaryHue", "140");
    $g.theme.setProperty("dark-primarySaturation", "75%");
    $g.theme.setProperty("dark-primaryLightness", "20%");

    $g.theme.setProperty("dark-secondaryHue", "140");
    $g.theme.setProperty("dark-secondarySaturation", "75%");
    $g.theme.setProperty("dark-secondaryLightness", "25%");

    var unresponsiveReconnectButton = Button() (_("unresponsive_reconnect"));

    var unresponsiveDialog = Dialog (
        DialogContent (
            Heading() (_("unresponsive_title")),
            Paragraph() (_("unresponsive_description"))
        ),
        ButtonRow (
            unresponsiveReconnectButton
        )
    );

    var selectElementButton = HeaderActionButton({
        icon: "point",
        alt: _("selectElement"),
        styles: {
            zIndex: "2"
        }
    }) ();

    unresponsiveReconnectButton.on("click", function() {
        window.location.reload();
    });

    selectElementButton.on("click", function() {
        protocol.call("selectElement");
    });

    var heartbeatReceived = true;

    var heartbeatInterval = setInterval(function() {
        if (!heartbeatReceived) {
            clearInterval(heartbeatInterval);

            window.console.warn("Heartbeat not received since last check");

            unresponsiveDialog.dialogOpen();
        }

        heartbeatReceived = false;

        protocol.call("heartbeat").then(function() {
            heartbeatReceived = true;
        });
    }, HEARTBEAT_INTERVAL);

    astronaut.render(
        Container (
            Screen(true) (
                Header (
                    TextFragment() (_("console")),
                    selectElementButton
                ),
                Page(true) (
                    console.Console() ()
                )
            ),
            unresponsiveDialog
        )
    );
});