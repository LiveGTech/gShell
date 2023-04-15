/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as shortcuts from "./shortcuts.js";

export var InteractionPage = astronaut.component("InteractionPage", function(props, children) {
    var checkForUpdatesSwitch = SwitchInput({value: true}) ();

    var interactionSwitches = {
        researchTelemetryEnabled: SwitchInput({value: false}) (),
        notifyResearchChanges: SwitchInput({value: false}) ()
    };

    var privacyInfoLink = NavigationalButton() (_("interaction_privacyInfo_link"));

    function updateData() {
        var data = _sphere.getPrivilegedData();

        if (!data) {
            return;
        }

        checkForUpdatesSwitch.setValue(data.updates_shouldAutoCheckForUpdates);

        Object.keys(interactionSwitches).forEach(function(key) {
            interactionSwitches[key].setValue(data.interaction_options?.[key] || false);
        });

        if (interactionSwitches.researchTelemetryEnabled.getValue()) {
            interactionSwitches.notifyResearchChanges.removeAttribute("disabled");
        } else {
            interactionSwitches.notifyResearchChanges.setValue(false);
            interactionSwitches.notifyResearchChanges.setAttribute("disabled", true);
        }
    }

    checkForUpdatesSwitch.on("change", function() {
        _sphere.callPrivilegedCommand("updates_setShouldAutoCheckForUpdates", {
            value: checkForUpdatesSwitch.getValue()
        });
    });

    Object.keys(interactionSwitches).forEach(function(key) {
        interactionSwitches[key].on("change", function() {
            _sphere.callPrivilegedCommand("interaction_setOption", {
                name: key,
                value: interactionSwitches[key].getValue()
            });
        });
    });

    interactionSwitches.notifyResearchChanges.setAttribute("disabled", true);

    privacyInfoLink.on("click", function() {
        window.open("https://liveg.tech/os/privacy");
    });

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page (
        Section (
            Label (
                Text(_("interaction_checkForUpdates")),
                checkForUpdatesSwitch
            ),
            Paragraph() (_("interaction_checkForUpdates_description")),
            shortcuts.ShortcutLandmark("interaction_researchTelemetry") (),
            Heading(2) (_("interaction_researchTelemetry")),
            Paragraph() (_("interaction_researchTelemetry_description1")),
            Label (
                Text(_("interaction_researchTelemetry_enable")),
                interactionSwitches.researchTelemetryEnabled
            ),
            Label (
                Text(_("interaction_researchTelemetry_notifyChanges")),
                interactionSwitches.notifyResearchChanges
            ),
            Paragraph() (_("interaction_researchTelemetry_description2")),
            shortcuts.ShortcutLandmark("interaction_privacyInfo") (),
            Heading(2) (_("interaction_privacyInfo")),
            Paragraph() (_("interaction_privacyInfo_description")),
            privacyInfoLink
        )
    );
});