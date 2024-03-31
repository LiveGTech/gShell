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

    $g.sel("title").setText(_("webInvestigator"));

    $g.theme.setProperty("primaryHue", "140");
    $g.theme.setProperty("primarySaturation", "75%");
    $g.theme.setProperty("primaryLightness", "25%");

    astronaut.render(
        Screen(true) (
            Header (
                TextFragment() (_("webInvestigator"))
            ),
            Page(true) (
                Section (
                    Heading() ("LiveG Web Investigator"),
                    Paragraph() ("Hello, world! Welcome to Web Investigator."),
                    Paragraph() ("Web contents ID: ", protocol.webContentsId),
                    console.Console() ()
                )
            )
        )
    );
});