/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as settings from "./script.js";

var inputConfigData = null;
var layoutOptions = null;
var layoutsListIsDirty = false;

function findLayoutFromPath(path) {
    return layoutOptions
        .map((language) => language.layouts)
        .flat()
        .find((layout) => layout.path == path)
    ;
}

export var L10nPage = astronaut.component("L10nPage", function(props, children) {
    var localeSelectionInput = SelectionInput() ();
    var localeSelectionButton = Button() (_("apply"));
    var keyboardInputAddLayoutButton = Button() ("Add a layout"); // TODO: Translate
    var layoutsList = Container() ();

    function renderLayoutsList() {
        return _sphere.callPrivilegedCommand("input_loadInputDataFromConfig").then(function(data) {
            inputConfigData = data;
    
            layoutsList.clear().add(
                ...inputConfigData.keyboardLayouts.map(function(layout, i) {
                    var layoutData = findLayoutFromPath(layout.path);
                    var inputMethod = layoutData.inputMethods.find((inputMethod) => inputMethod.path == layout.inputMethodPaths?.[0]);

                    var button = ListButton() (
                        BoldTextFragment() (layoutData.metadata.variantName),
                        LineBreak() (),
                        TextFragment() (inputMethod?.metadata.displayName || "(None)") // TODO: Translate none
                    );

                    button.on("click", function() {
                        var dialog = InputConfigDialog({addingLayout: false, id: i}) ();
    
                        settings.registerDialog(dialog);
    
                        dialog.dialogOpen();
                    });

                    return button;
                })
            );

            return Promise.resolve();
        });
    }

    localeSelectionButton.on("click", function() {
        _sphere.callPrivilegedCommand("l10n_setLocale", {
            localeCode: localeSelectionInput.getValue()
        }).then(function() {
            window.location.reload();
        });
    });

    keyboardInputAddLayoutButton.on("click", function() {
        if (layoutOptions == null) {
            return;
        }

        var dialog = InputConfigDialog({addingLayout: true}) ();

        settings.registerDialog(dialog);

        dialog.dialogOpen();
    });

    fetch("./l10n.json").then(function(response) {
        return response.json();
    }).then(function(data) {
        localeSelectionInput.clear().add(
            ...Object.keys(data.locales).map((localeCode) => SelectionInputOption(localeCode) (Text(data.locales[localeCode])))
        );

        localeSelectionInput.setValue($g.l10n.getSystemLocaleCode());
    });

    _sphere.callPrivilegedCommand("input_getAllKeyboardLayoutOptions").then(function(options) {
        layoutOptions = options;

        renderLayoutsList();

        setInterval(function() {
            if (layoutsListIsDirty) {
                renderLayoutsList();
                
                layoutsListIsDirty = false;
            }
        });
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
                layoutsList,
                ButtonRow (
                    keyboardInputAddLayoutButton
                )
            )
        )
    );
});

export var InputConfigDialog = astronaut.component("L10nInputConfigDialog", function(props, children) {
    // TODO: Translate

    var languageSelectionInput = SelectionInput() ();
    var layoutSelectionInput = SelectionInput() ();
    var inputMethodSelectionInput = SelectionInput() ();
    var addButton = Button() ("Add");
    var saveButton = Button() ("Save");
    var removeButton = Button("dangerous") ("Remove");

    var dialog = Dialog (
        Heading() (props.addingLayout ? "Add layout" : "Configure layout"),
        DialogContent (
            Label (
                Text("Language"),
                languageSelectionInput
            ),
            Label (
                Text("Layout"),
                layoutSelectionInput
            ),
            Label (
                Text("Input method"),
                inputMethodSelectionInput
            )
        ),
        props.addingLayout ? ButtonRow("end") (
            addButton,
            Button({
                mode: "secondary",
                attributes: {
                    "aui-bind": "close"
                }
            }) ("Cancel")
        ) : ButtonRow("end") (
            saveButton,
            removeButton
        )
    );

    function renderInputMethodSelectionInput() {
        if (layoutOptions == null) {
            return;
        }

        inputMethodSelectionInput.clear().add(
            ...layoutOptions
                .find((language) => language.localeCode == languageSelectionInput.getValue())
                .layouts
                .find((layout) => layout.variant == layoutSelectionInput.getValue())
                .inputMethods
                .map((inputMethod) => SelectionInputOption(inputMethod.type) (inputMethod.metadata.displayName))
        );
    }

    function renderLayoutSelectionInput() {
        if (layoutOptions == null) {
            return;
        }

        layoutSelectionInput.clear().add(
            ...layoutOptions
                .find((language) => language.localeCode == languageSelectionInput.getValue())
                .layouts
                .map((layout) => SelectionInputOption(layout.variant) (layout.metadata.variantName))
        );

        renderInputMethodSelectionInput();
    }

    function getLayoutConfigData() {
        var selectedLayout = layoutOptions
            .find((language) => language.localeCode == languageSelectionInput.getValue())
            .layouts
            .find((layout) => layout.variant == layoutSelectionInput.getValue())
        ;

        var selectedInputMethod = selectedLayout.inputMethods.find((inputMethod) => inputMethod.type == inputMethodSelectionInput.getValue());

        return {
            path: selectedLayout.path,
            inputMethodPaths: selectedInputMethod ? [selectedInputMethod.path] : []
        };
    }

    languageSelectionInput.on("change", function() {
        renderLayoutSelectionInput();
    });

    layoutSelectionInput.on("change", function() {
        renderInputMethodSelectionInput();
    });

    addButton.on("click", function() {
        if (layoutOptions == null || inputConfigData == null) {
            return;
        }

        inputConfigData.keyboardLayouts.push(getLayoutConfigData());

        _sphere.callPrivilegedCommand("input_saveInputDataToConfig", {data: inputConfigData}).then(function() {
            layoutsListIsDirty = true;
        });

        dialog.dialogClose();
    });

    saveButton.on("click", function() {
        if (layoutOptions == null || inputConfigData == null || !inputConfigData.keyboardLayouts[props.id]) {
            return;
        }

        inputConfigData.keyboardLayouts[props.id] = getLayoutConfigData();

        _sphere.callPrivilegedCommand("input_saveInputDataToConfig", {data: inputConfigData}).then(function() {
            layoutsListIsDirty = true;
        });

        dialog.dialogClose();
    });

    removeButton.on("click", function() {
        if (layoutOptions == null || inputConfigData == null || !inputConfigData.keyboardLayouts[props.id]) {
            return;
        }

        if (inputConfigData.keyboardLayouts.length <= 1) {
            return;
        }

        inputConfigData.keyboardLayouts.splice(props.id, 1);

        _sphere.callPrivilegedCommand("input_saveInputDataToConfig", {data: inputConfigData}).then(function() {
            layoutsListIsDirty = true;
        });

        dialog.dialogClose();
    });

    languageSelectionInput.clear().add(
        ...layoutOptions.map((language) => SelectionInputOption(language.localeCode) (language.name))
    );

    var defaultLayout = layoutOptions.find((option) => option.localeCode == $g.l10n.getSystemLocaleCode()).layouts[0];

    defaultLayout ||= layoutOptions.find((option) => option.localeCode == "en_GB").layouts[0];

    languageSelectionInput.setValue(defaultLayout.localeCode);
    layoutSelectionInput.setValue(defaultLayout.variant);
    inputMethodSelectionInput.setValue(defaultLayout.inputMethods[0]?.type);

    if (!props.addingLayout) {
        var keyboardLayout = findLayoutFromPath(inputConfigData.keyboardLayouts[props.id]?.path);

        if (keyboardLayout == null) {
            return;
        }

        languageSelectionInput.setValue(keyboardLayout.localeCode);
        layoutSelectionInput.setValue(keyboardLayout.variant);
        layoutSelectionInput.setValue(keyboardLayout.inputMethods[0]?.type);
    }

    if (inputConfigData.keyboardLayouts.length <= 1) {
        removeButton.setAttribute("disabled", true);
    }

    renderLayoutSelectionInput();

    return dialog;
});