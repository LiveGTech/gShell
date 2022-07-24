/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
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

    enableSwitch.on("change", function(event) {
        // TODO: Add confirmation dialog when disabling Switch Navigation

        if (!enableSwitch.getValue()) {
            switchNavigationDisableDialog.dialogOpen();
            enableSwitch.setValue(true);

            return;
        }

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

export var SwitchNavigationDisableDialog = astronaut.component("SwitchNavigationDisableDialog", function(props, children) {
    var turnOffButton = Button() (_("a11y_switch_disableDialog_turnOff"));

    var dialog = Dialog (
        Heading() (_("a11y_switch_disableDialog_title")),
        DialogContent (
            Paragraph() (_("a11y_switch_disableDialog_description"))
        ),
        ButtonRow({
            attributes: {
                "aui-mode": "end"
            }
        }) (
            turnOffButton,
            Button({
                mode: "secondary",
                attributes: {
                    "aui-bind": "close"
                }
            }) (_("cancel"))
        )
    );

    turnOffButton.on("click", function() {
        _sphere.callPrivilegedCommand("a11y_setOption", {
            name: "switch_enabled",
            value: false
        });

        dialog.dialogClose();
    });

    return dialog;
});

export var switchNavigationDisableDialog = null;

export function init() {
    switchNavigationDisableDialog = SwitchNavigationDisableDialog() ();
    
    settings.registerDialog(switchNavigationDisableDialog);
}