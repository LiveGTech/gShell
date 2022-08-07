/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

export var L10nPage = astronaut.component("L10nPage", function(props, children) {
    var localeSelectionInput = SelectionInput() ();

    localeSelectionInput.on("change", function() {
        _sphere.callPrivilegedCommand("l10n_setLocale", {
            localeCode: localeSelectionInput.getValue()
        });

        window.location.reload();
    });

    fetch("./l10n.json").then(function(response) {
        return response.json();
    }).then(function(data) {
        localeSelectionInput.clear().add(
            ...Object.keys(data.locales).map((localeCode) => SelectionInputOption(localeCode) (Text(data.locales[localeCode])))
        );

        localeSelectionInput.setValue($g.l10n.getSystemLocaleCode());
    });

    return Page (
        Section (
            Label (
                Text(_("l10n_systemLanguage")),
                localeSelectionInput
            )
        )
    );
});