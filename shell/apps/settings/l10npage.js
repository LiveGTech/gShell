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
    var localeSelectionButton = Button() (_("apply"));

    localeSelectionButton.on("click", function() {
        _sphere.callPrivilegedCommand("l10n_setLocale", {
            localeCode: localeSelectionInput.getValue()
        }).then(function() {
            window.location.reload();
        });
    });

    // TODO: Present this data in a UI
    _sphere.callPrivilegedCommand("input_getAllKeyboardLayoutOptions").then(function(data) {
        console.log(data);
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
            ),
            Paragraph() (_("l10n_changeMessage")),
            ButtonRow (
                localeSelectionButton
            )
        ),
        Section ( // TODO: Translate
            Heading(2) ("Keyboard input"),
            Heading(3) ("Layouts"),
            Paragraph() ("You can add multiple keyboard layouts to easily switch between different languages and input modes when writing text."),
            Container (
                ListButton() (
                    BoldTextFragment() ("British QWERTY"),
                    LineBreak() (),
                    TextFragment() ("British English spelling and suggestions")
                ),
                ListButton() (
                    BoldTextFragment() ("British QWERTY"),
                    LineBreak() (),
                    TextFragment() ("简体中文（中国）拼音（pīnyīn）")
                ),
                ListButton() (
                    BoldTextFragment() ("AZERTY"),
                    LineBreak() (),
                    TextFragment() ("British English spelling and suggestions")
                ),
                ButtonRow (
                    Button() ("Add a layout")
                )
            )
        )
    );
});