/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as screenScroll from "gshell://lib/adaptui/src/screenscroll.js";

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";
import * as l10n from "gshell://config/l10n.js";
import * as switcher from "gshell://userenv/switcher.js";

export var configData = null;

var scrollers = null;

export function init() {
    scrollers = [];

    $g.sel(".home").getAll().forEach(function(homeElement) {
        homeElement = $g.sel(homeElement);

        var scroller = new screenScroll.ScrollableScreen(homeElement);

        scrollers.push(scroller);

        homeElement.on("focusin", function(event) {
            var target = $g.sel(event.target);

            if (target.is(".home_page *")) {
                scroller.targetScrollX = target.ancestor(".home_page").get().offsetLeft;
            }
        });
    });

    $g.sel(".home_gridViewButton").on("click", function() {
        if (!$g.sel(".home.home_appMenuTab").hasAttribute("hidden")) {
            return;
        }

        $g.sel(".desktop_appMenuSide button").removeClass("selected");
        $g.sel(".home_gridViewButton").addClass("selected");

        Promise.all($g.sel(".home_appMenuTab", true).fadeOut(250)).then(function() {
            $g.sel(".desktop_appMenuLayout").addClass("gridViewSelected");

            $g.sel(".home.home_appMenuTab").fadeIn(250);
        });
    });

    $g.sel(".home_alphabeticalViewButton").on("click", function() {
        if (!$g.sel(".home_alphabeticalView.home_appMenuTab").hasAttribute("hidden")) {
            return;
        }

        $g.sel(".desktop_appMenuSide button").removeClass("selected");
        $g.sel(".home_alphabeticalViewButton").addClass("selected");

        Promise.all($g.sel(".home_appMenuTab", true).fadeOut(250)).then(function() {
            $g.sel(".desktop_appMenuLayout").removeClass("gridViewSelected");

            $g.sel(".home_alphabeticalView.home_appMenuTab").fadeIn(250);
        });
    });

    users.onUserStateChange(function(user) {
        if (user != null) {
            load();
        }
    });
}

function createApp(appDetails) {
    var button = $g.create("button")
        .addClass("home_app")
        .add(
            $g.create("img")
                .addClass("home_icon")
                .setAttribute("src", appDetails.icon || "gshell://media/appdefault.svg")
                .setAttribute("aria-hidden", true)
                .on("error", function() {
                    button.find(".home_icon").setAttribute("src", "gshell://media/appdefault.svg")
                })
            ,
            $g.create("span").setText(appDetails.name)
        )
        .on("click", function() {
            if (typeof(appDetails.url) != "string") {
                return;
            }

            switcher.openApp(appDetails.url, appDetails);
        })
    ;

    return button;
}

export function load() {
    return users.getCurrentUser().then(function(user) {
        if (user == null) {
            return; // No user signed in right now
        }

        var defaultConfigData;

        return fetch("gshell://apps/defaults.json").then(function(response) {
            return response.json();
        }).then(function(data) {
            defaultConfigData = data;

            return config.read(`users/${user.uid}/apps.gsc`);
        }).then(function(data) {
            configData = defaultConfigData;

            configData.apps = {...configData.apps, ...(data.apps || {})};

            $g.sel(".home").getAll().forEach(function(homeElement) {
                homeElement = $g.sel(homeElement);

                homeElement.clear();

                $g.sel(".home_alphabeticalView").clear();

                Object.values(configData.apps).forEach(function(app) {
                    var appElement = createApp({
                        ...app,
                        name: app.name[l10n.currentLocale.localeCode] || app.name[app.fallbackLocale]
                    });

                    var firstFreePage = homeElement.find(".home_page").filter((page) => page.find(".home_app").items().length < 24);

                    if (firstFreePage.items().length == 0) {
                        firstFreePage = $g.create("div").addClass("home_page");

                        homeElement.add(firstFreePage);
                    }

                    firstFreePage.add(appElement);
                });
            });

            $g.sel(".home_alphabeticalView").getAll().forEach(function(homeElement) {
                homeElement = $g.sel(homeElement);

                homeElement.clear();

                Object.values(configData.apps)
                    .map(function(app) {
                        app.displayName = app.name[l10n.currentLocale.localeCode] || app.name[app.fallbackLocale];

                        return app;
                    })
                    .sort((a, b) => l10n.currentLocale.createCollator().compare(a.displayName, b.displayName))
                    .forEach(function(app) {
                        var appElement = createApp({
                            ...app,
                            name: app.displayName
                        });

                        homeElement.add(appElement);
                    })
                ;
            });

            scrollers.forEach(function(scroller, i) {
                scroller.applyPagination($g.sel($g.sel(".home_pagination").getAll()[i]));
            });
        });
    });
}