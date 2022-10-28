/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as settings from "./script.js";

export var L10nPage = astronaut.component("L10nPage", function(props, children) {
    var localeSelectionInput = SelectionInput() ();
    var localeSelectionButton = Button() (_("apply"));

    var keyboardInputAddLayoutButton = Button() ("Add a layout"); // TODO: Translate

    localeSelectionButton.on("click", function() {
        _sphere.callPrivilegedCommand("l10n_setLocale", {
            localeCode: localeSelectionInput.getValue()
        }).then(function() {
            window.location.reload();
        });
    });

    keyboardInputAddLayoutButton.on("click", function() {
        var dialog = InputConfigDialog({addingLayout: true}) ();

        settings.registerDialog(dialog);

        dialog.dialogOpen();
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
                ).on("click", function() {
                    var dialog = InputConfigDialog({addingLayout: false}) ();

                    settings.registerDialog(dialog);

                    dialog.dialogOpen();
                }),
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
                    keyboardInputAddLayoutButton
                )
            )
        )
    );
});

export var InputConfigDialog = astronaut.component("L10nInputConfigDialog", function(props, children) {
    // TODO: Translate and add proper implementation
    return Dialog (
        Heading() (props.addingLayout ? "Add layout" : "Configure layout"),
        DialogContent (
            Label (
                Text("Language"),
                SelectionInput("en_GB") (
                    SelectionInputOption("en_GB") ("English (United Kingdom)"),
                    SelectionInputOption("fr_FR") ("Français (France)"),
                    SelectionInputOption("zh_CN") ("简体中文（中国）")
                )
            ),
            Label (
                Text("Layout"),
                SelectionInput("en_GB_qwerty") (
                    SelectionInputOption("en_GB_qwerty") ("British QWERTY"),
                    SelectionInputOption("fr_FR_azerty") ("AZERTY")
                )
            ),
            Label (
                Text("Input method"),
                SelectionInput("en_GB_default") (
                    SelectionInputOption("en_GB_default") ("British English spelling and suggestions"),
                    SelectionInputOption("zh_CN_pinyin") ("简体中文（中国）拼音（pīnyīn）")
                )
            )
        ),
        props.addingLayout ? ButtonRow("end") (
            Button() ("Add"),
            Button({
                mode: "secondary",
                attributes: {
                    "aui-bind": "close"
                }
            }) ("Cancel")
        ) : ButtonRow("end") (
            Button() ("Save"),
            Button({
                mode: "dangerous",
                attributes: {
                    "aui-bind": "close"
                }
            }) ("Remove")
        )
    );
});