/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as settings from "./script.js";

export var A11yPage = astronaut.component("A11yPage", function(props, children) {
    var switchNavigationButton = IconListButton (
        Icon("gesture", "dark embedded") (),
        Container (
            BoldTextFragment() (_("a11y_switch")),
            LineBreak() (),
            _("a11y_switch_summary")
        )
    );

    var reduceMotionSwitch = SwitchInput() ();

    switchNavigationButton.on("click", function() {
        settings.visitInnerScreen(
            SwitchNavigationScreen() (
                SwitchNavigationScreen() ()
            )
        );
    });

    reduceMotionSwitch.on("change", function() {
        _sphere.callPrivilegedCommand("a11y_setOption", {
            name: "display_reduceMotion",
            value: !_sphere.getPrivilegedData()?.a11y_options?.display_reduceMotion
        });
    });

    function updateData() {
        var data = _sphere.getPrivilegedData();

        reduceMotionSwitch.setValue(!!data?.a11y_options?.display_reduceMotion);
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page (
        Section (
            switchNavigationButton
        ),
        Section (
            Container({
                attributes: {
                    "tabindex": "0",
                    "aria-role": "group"
                }
            }) (
                Label() (
                    Text(_("a11y_reduceMotion")),
                    reduceMotionSwitch
                )
            )
        )
    );
});

export var SwitchNavigationScreen = astronaut.component("SwitchNavigationScreen", function(props, children) {
    var active = true;

    var enableSwitch = SwitchInput() ();

    enableSwitch.on("change", function() {
        // TODO: Add confirmation dialog when disabling Switch Navigation

        _sphere.callPrivilegedCommand("a11y_setOption", {
            name: "switch_enabled",
            value: !_sphere.getPrivilegedData()?.a11y_options?.switch_enabled
        });
    });

    var screen = settings.InnerScreen({title: _("a11y_switch")}) (
        Page(true) (
            Section (
                Heading() (_("a11y_switch")),
                Paragraph() (_("a11y_switch_description")),
                Label (
                    Text(_("a11y_switch_enable")),
                    enableSwitch
                )
            )
        )
    );

    screen.on("removed", function() {
        active = false;
    });

    function updateData() {
        if (!active) {
            return;
        }

        var data = _sphere.getPrivilegedData();

        enableSwitch.setValue(!!data?.a11y_options?.switch_enabled);
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return screen;
});