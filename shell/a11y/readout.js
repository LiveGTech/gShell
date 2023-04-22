/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";

export const NAME = "readout";

const VALID_ARIA_ROLES = ["article", "button", "cell", "checkbox", "columnheader", "dialog", "document", "expandable", "figure", "form", "heading", "img", "input", "link", "list", "listbox", "listitem", "main", "mark", "marquee", "math", "navigation", "progressbar", "radio", "row", "searchbox", "section", "slider", "switch", "table", "textbox", "textarea", "urlinput"];

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

        if (data.role && VALID_ARIA_ROLES.includes(data.role)) {
            addSeparator();

            // TODO: Translate to French

            announcementElement.add(
                $g.create("strong").setText(_(`a11y_readout_role_${data.role}`))
            );
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