/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";

export const NAME = "readout";

export class ReadoutNavigation extends a11y.AssistiveTechnology {
    init() {
        console.log("Readout Navigation loaded");

        var readoutWasEnabled = false;

        setInterval(function() {
            if (!a11y.options.readout_enabled) {
                if (readoutWasEnabled) {
                    $g.sel(".a11y_panel.readout").fadeOut();
                }

                readoutWasEnabled = false;

                return;
            }

            if (!readoutWasEnabled) {
                $g.sel(".a11y_panel.readout").fadeIn();
            }

            readoutWasEnabled = true;
        });
    }

    update() {
        console.log("Readout Navigation state updated:", a11y.options.readout_enabled);
    }

    announce(data) {
        if (!a11y.options.readout_enabled) {
            return;
        }

        console.log("Readout Navigation announcement received:", data);

        var announcementElement = $g.sel(".a11y_readout_announcement");

        function addSeparator() {
            if (announcementElement.getText() == "") {
                return;
            }

            announcementElement.add(
                $g.create("span").setText(" · ")
            );
        }

        announcementElement.clear();

        if (data.description) {
            addSeparator();

            announcementElement.add(
                $g.create("span").setText(data.description)
            );
        }

        if (data.role) {
            addSeparator();

            announcementElement.add(
                $g.create("strong").setText(data.role) // TODO: Localise ARIA roles
            )
        }

        if (data.label) {
            addSeparator();

            announcementElement.add(
                $g.create("em").setText(data.label)
            )
        }
    }
}

a11y.registerAssistiveTechnology(ReadoutNavigation);