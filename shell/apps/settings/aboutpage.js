/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as about from "gshell://about.js";
import * as shortcuts from "./shortcuts.js";

export var AboutPage = astronaut.component("AboutPage", function(props, children) {
    var deviceInfoSection = Section() ();

    function updateData() {
        var data = _sphere.getPrivilegedData();

        if (typeof(data?.device_data) == "object") {
            var modelInfo = data.device_data.model;
            var localeCode = $g.l10n.getSystemLocaleCode();

            function getLocalisedProperty(property) {
                return property[localeCode] || property[modelInfo.fallbackLocale]
            }

            deviceInfoSection.clear().add(
                shortcuts.ShortcutLandmark("about_deviceInfo") (),
                Heading(2) (_("about_deviceInfo")),
                PropertyList (
                    Property() (_("about_deviceInfo_name"), Text(getLocalisedProperty(modelInfo.name))),
                    Property() (_("about_deviceInfo_manufacturer"), Text(getLocalisedProperty(modelInfo.manufacturer))),
                    modelInfo.serial != null ? Property() (_("about_deviceInfo_serial"), CodeSnippet() (modelInfo.serial)) : TextFragment() ()
                )
            );
        }
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page (
        Section({attributes: {"aui-justify": "middle"}}) (
            Heading({level: 1, styles: {"margin-bottom": "0"}}) (
                BrandWordmark(_("about_name").trim(), "gshell://media/logo.svg") (
                    Text(_("about_name"))
                )
            ),
            // TODO: Remove this after V0.3.0 (10th Anniversary Edition message/badge)
            Container({
                styles: {
                    "display": "flex",
                    "gap": "0.5rem",
                    "align-items": "center",
                    "justify-content": "center",
                    "margin-top": "0.5rem"
                }
            }) (
                Image({
                    source: `gshell://media/10years_${$g.l10n.getSystemLocaleCode().split("_")[0]}.svg`,
                    alt: "",
                    styles: {
                        "width": "unset",
                        "height": "2rem",
                        "margin": "0"
                    }
                }) (),
                BoldTextFragment() (_("about_10years"))
            ),
            Paragraph() (_("about_version", {version: about.VERSION})),
            Paragraph() (_("about_copyright"))
        ),
        deviceInfoSection
    );
});