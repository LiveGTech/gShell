/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

astronaut.unpack();

import * as network from "./networkpage.js";

export const PAGE_ICONS = {
    network: "wifi"
};

export var pages = {};

var pageMenuButtons = {};
var homePageBackButton = null;
var homePageMenuButton = null;
var headerText = null;

export function switchToPage(pageId) {
    pageMenuButtons[pageId].get().click();
    homePageBackButton.show();
    headerText.setText(_(pageId));
}

export function goToHomePage() {
    homePageMenuButton.get().click();
    homePageBackButton.hide();
    headerText.setText(_("settings"));
}

$g.waitForLoad().then(function() {
    return $g.l10n.selectLocaleFromResources({
        "en_GB": "locales/en_GB.json"
    });
}).then(function(locale) {
    window._ = function() {
        return locale.translate(...arguments);
    };

    pages.network = network.NetworkPage() ();

    Object.keys(pages).forEach(function(pageId) {
        pageMenuButtons[pageId] = PageMenuButton({page: pages[pageId]}) (_(pageId));
    });

    var homePage = Page(true) (
        Section (
            ...Object.keys(pages).map(function(pageId) {
                var summary = TextFragment() (_(`${pageId}_summary`));

                var button = ListButton (
                    Icon(PAGE_ICONS[pageId], "dark embedded") (),
                    BoldTextFragment() (_(pageId)),
                    LineBreak() (),
                    summary
                );

                switch (pageId) {
                    case "network":
                        network.connectSummary(summary);
                        break;
                }

                button.on("click", function() {
                    switchToPage(pageId);
                });

                return button;
            })
        )
    );

    homePageMenuButton = PageMenuButton({page: homePage}) ();
    homePageBackButton = IconButton({icon: "back", alt: _("back"), attributes: {"aui-display": "nonFull"}}) ();
    headerText = TextFragment() (_("settings"));

    homePageMenuButton.setStyle("display", "none");
    homePageBackButton.hide();

    homePageBackButton.on("click", function() {
        goToHomePage();
    });

    astronaut.render(
        Screen(true) (
            Header (
                homePageBackButton,
                headerText
            ),
            PageMenu (
                ...Object.values(pageMenuButtons),
                homePageMenuButton
            ),
            homePage,
            ...Object.values(pages)
        )
    );
});