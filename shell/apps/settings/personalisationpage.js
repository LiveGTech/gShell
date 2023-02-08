/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as shortcuts from "./shortcuts.js";

export var PersonalisationPage = astronaut.component("PersonalisationPage", function(props, children) {
    var previousThemeMode = null;
    var themeModesContainer = Container() ();

    function updateData() {
        var data = _sphere.getPrivilegedData();

        if (previousThemeMode != data?.personalisation_themeMode) {
            themeModesContainer.clear().add(
                ...["light", "dark"].map(function(themeMode) {
                    var radioButton = RadioButtonInput({group: "themeModes"}) ();

                    if (themeMode == data?.personalisation_themeMode) {
                        radioButton.setValue(true);
                    }

                    radioButton.on("change", function() {
                        if (radioButton.getValue()) {
                            _sphere.callPrivilegedCommand("personalisation_setOption", {
                                name: "themeMode",
                                value: themeMode
                            });
                        }
                    });

                    return Label (
                        radioButton,
                        Text(_(`personalisation_themeMode_${themeMode}`))
                    )
                })
            );

            previousThemeMode = data?.personalisation_themeMode;
        }
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page (
        Section (
            shortcuts.ShortcutLandmark("personalisation_theme") (),
            Heading(2) (_("personalisation_theme")),
            themeModesContainer
        )
    );
});