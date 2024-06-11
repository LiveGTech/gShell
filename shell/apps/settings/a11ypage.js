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
    var readoutNavigationButton = IconListButton (
        Icon("readout", "dark embedded") (),
        Container (
            BoldTextFragment() (_("a11y_readout")),
            LineBreak() (),
            _("a11y_readout_summary")
        )
    );

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
            SwitchNavigationScreen() ()
        );
    });

    readoutNavigationButton.on("click", function() {
        settings.visitInnerScreen(
            ReadoutNavigationScreen() ()
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
            readoutNavigationButton,
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

export var ReadoutNavigationScreen = astronaut.component("ReadoutNavigationScreen", function(props, children) {
    var active = true;

    var enableSwitch = SwitchInput() ();

    enableSwitch.on("change", function(event) {
        if (!enableSwitch.getValue()) {
            readoutNavigationDisableDialog.dialogOpen();
            enableSwitch.setValue(true);

            return;
        }

        _sphere.callPrivilegedCommand("a11y_setOption", {
            name: "readout_enabled",
            value: !_sphere.getPrivilegedData()?.a11y_options?.readout_enabled
        });
    });

    var screen = settings.InnerScreen({title: _("a11y_readout")}) (
        Page(true) (
            Section (
                Heading() (_("a11y_readout")),
                Paragraph() (_("a11y_readout_description")),
                Label (
                    Text(_("a11y_readout_enable")),
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

        enableSwitch.setValue(!!data?.a11y_options?.readout_enabled);
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return screen;
});

export var ReadoutNavigationDisableDialog = astronaut.component("ReadoutNavigationDisableDialog", function(props, children) {
    var turnOffButton = Button() (_("a11y_readout_disableDialog_turnOff"));

    var dialog = Dialog (
        Heading() (_("a11y_readout_disableDialog_title")),
        DialogContent (
            Paragraph() (_("a11y_readout_disableDialog_description"))
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
            name: "readout_enabled",
            value: false
        });

        dialog.dialogClose();
    });

    return dialog;
});

export var SwitchNavigationScreen = astronaut.component("SwitchNavigationScreen", function(props, children) {
    var active = true;

    var enableSwitch = SwitchInput() ();

    enableSwitch.on("change", function(event) {
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

export var readoutNavigationDisableDialog = null;
export var switchNavigationDisableDialog = null;

export function init() {
    readoutNavigationDisableDialog = ReadoutNavigationDisableDialog() ();
    switchNavigationDisableDialog = SwitchNavigationDisableDialog() ();
    
    settings.registerDialog(readoutNavigationDisableDialog);
    settings.registerDialog(switchNavigationDisableDialog);
}