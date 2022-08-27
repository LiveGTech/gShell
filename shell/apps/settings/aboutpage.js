/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as about from "gshell://about.js";

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
            Paragraph() (_("about_version", {version: about.VERSION})),
            Paragraph() (_("about_copyright"))
        ),
        deviceInfoSection
    );
});