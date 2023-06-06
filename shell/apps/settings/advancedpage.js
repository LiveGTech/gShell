/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

export const UPDATE_CIRCUITS = ["main", "beta", "alpha", "test"];

export var AdvancedPage = astronaut.component("AdvancedPage", function(props, children) {
    var updateCircuitInput = SelectionInput({
        styles: {
            fontFamily: "var(--fontCode)"
        }
    }) (
        ...UPDATE_CIRCUITS.map((circuit) => SelectionInputOption(circuit) (circuit))
    );

    function updateData() {
        var data = _sphere.getPrivilegedData();

        updateCircuitInput.setValue(data?.updates_updateCircuit);
    }

    updateCircuitInput.on("change", function() {
        _sphere.callPrivilegedCommand("updates_setUpdateCircuit", {circuit: updateCircuitInput.getValue()});
    });

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page (
        Section (
            Heading(2) (_("advanced_updates")),
            Paragraph() (_("advanced_updates_updateCircuit_description")),
            Label (
                Text(_("advanced_updates_updateCircuit")),
                updateCircuitInput
            )
        )
    );
});