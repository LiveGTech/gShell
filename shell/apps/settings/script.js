/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as screens from "gshell://lib/adaptui/src/screens.js";
import * as markup from "gshell://lib/adaptui/src/markup.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

astronaut.unpack();

import * as shortcuts from "./shortcuts.js";
import * as network from "./networkpage.js";
import * as l10n from "./l10npage.js";
import * as a11y from "./a11ypage.js";
import * as about from "./aboutpage.js";
import * as personalisation from "./personalisationpage.js";

export const PAGE_ICONS = {
    network: "wifi",
    l10n: "language",
    personalisation: "brush",
    a11y: "a11y",
    about: "info"
};

export var pages = {};

var pageMenuButtons = {};
var homePageBackButton = null;
var homePageMenuButton = null;
var headerText = null;
var root = Container() ();

export function updateHeader(pageId) {
    homePageBackButton.show();
    headerText.setText(_(pageId));
}

export function switchToPage(pageId) {
    pageMenuButtons[pageId].get().click();
    updateHeader(pageId);
}

export function goToHomePage() {
    homePageMenuButton.get().click();
    homePageBackButton.hide();
    headerText.setText(_("settings"));
}

export function visitInnerScreen(screen) {
    root.add(screen);

    setTimeout(function() {
        screen.screenForward();        
    });
}

export function registerDialog(dialog) {
    root.add(dialog);

    markup.apply();
}

export var InnerScreen = astronaut.component("InnerScreen", function(props, children, inter) {
    var backButton = IconButton({icon: "back", alt: _("back")}) ();
    var screen = Screen() (
        Header (
            backButton,
            Text(props.title)
        ),
        Page(true) (...children)
    );

    inter.exit = function() {
        screens.navigateBack().then(function() {
            screen.remove();

            screen.emit("removed");
        });
    };

    backButton.on("click", function() {
        inter.exit();
    });

    return screen;
});

$g.waitForLoad().then(function() {
    return $g.l10n.selectLocaleFromResources({
        "en_GB": "locales/en_GB.json",
        "fr_FR": "locales/fr_FR.json"
    }, "en_GB", {
        "fr_FR": "en_GB"
    });
}).then(function(locale) {
    window._ = function() {
        return locale.translate(...arguments);
    };

    $g.sel("title").setText(_("settings"));

    pages.network = network.NetworkPage() ();
    pages.l10n = l10n.L10nPage() ();
    pages.personalisation = personalisation.PersonalisationPage() ();
    pages.a11y = a11y.A11yPage() ();
    pages.about = about.AboutPage() ();

    Object.keys(pages).forEach(function(pageId) {
        pageMenuButtons[pageId] = PageMenuButton({page: pages[pageId]}) (_(pageId));

        pageMenuButtons[pageId].on("click", function() {
            updateHeader(pageId);
        });
    });

    a11y.init();

    var homePage = Page(true) (
        Section (
            ...Object.keys(pages).map(function(pageId) {
                var summary = TextFragment() (_(`${pageId}_summary`));

                var button = IconListButton (
                    Icon(PAGE_ICONS[pageId], "dark embedded") (),
                    Container (
                        BoldTextFragment() (_(pageId)),
                        LineBreak() (),
                        summary
                    )
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
    headerText = TextFragment({attributes: {"aui-display": "nonFull"}}) (_("settings"));

    homePageMenuButton.setStyle("display", "none");
    homePageBackButton.hide();

    homePageBackButton.on("click", function() {
        goToHomePage();
    });

    root.add(
        Screen(true) (
            Header (
                homePageBackButton,
                TextFragment({attributes: {"aui-display": "full"}}) (_("settings")),
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

    astronaut.render(root);

    shortcuts.run();
});