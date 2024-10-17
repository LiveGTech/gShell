/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as aui_a11y from "gshell://lib/adaptui/src/a11y.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as settings from "./script.js";
import * as network from "./networkpage.js";
import * as a11y from "./a11ypage.js";

export var ShortcutLandmark = astronaut.component({name: "ShortcutLandmark", positionals: ["name"]}, function(props, children) {
    return Container({
        attributes: {
            "shortcut-name": props.name
        }
    }) ();
});

export function getName() {
    return $g.core.parameter("shortcut");
}

export function jumpToLandmark(name = getName()) {
    setTimeout(function() {
        var element = $g.sel("[shortcut-name]").filter((element) => element.getAttribute("shortcut-name") == name);

        if (!element.exists()) {
            return;
        }

        element.get().scrollIntoView({
            alignToTop: true
        });
    }, aui_a11y.prefersReducedMotion() ? 0 : 500);
}

export function run(name = getName()) {
    switch (name) {
        case "network":
        case "network_wifi":
            settings.switchToPage("network");
            break;

        case "network_proxyConfig":
            settings.switchToPage("network");

            settings.visitInnerScreen(
                network.ProxyConfigScreen() ()
            );

            break;

        case "l10n":
        case "l10n_input":
            settings.switchToPage("l10n");
            break;

        case "personalisation":
        case "personalisation_theme":
            settings.switchToPage("personalisation");
            break;


        case "a11y":
            settings.switchToPage("a11y");
            break;

        case "a11y_readout":
            settings.switchToPage("a11y");

            settings.visitInnerScreen(
                a11y.ReadoutNavigationScreen() ()
            );

            break;

        case "a11y_switch":
            settings.switchToPage("a11y");

            settings.visitInnerScreen(
                a11y.SwitchNavigationScreen() ()
            );

            break;

        case "interaction":
        case "interaction_researchTelemetry":
        case "interaction_privacyInfo":
            settings.switchToPage("interaction");
            break;

        case "updates":
            settings.switchToPage("updates");
            break;

        case "advanced":
            settings.switchToPage("advanced");
            break;

        case "about":
        case "about_deviceInfo":
            settings.switchToPage("about");
            break;

        case null:
            break;

        default:
            console.warn(`Unknown shortcut: "${name}"`);
            break;
    }

    jumpToLandmark();
}