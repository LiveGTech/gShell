/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as screenScroll from "gshell://lib/adaptui/src/screenscroll.js";
import Fuse from "gshell://lib/fuse.esm.js";

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";
import * as l10n from "gshell://config/l10n.js";
import * as switcher from "gshell://userenv/switcher.js";

export const searchResultTypes = {
    APP: 0,
    SHORTCUT: 1
};

export var configData = null;
export var views = null;

var searcher = null;
var searchLastView = null;
var scrollers = null;

export class View {
    constructor(element, buttonElement = null, usesPagination = false, clearSearch = true) {
        var thisScope = this;

        this.element = element;
        this.buttonElement = buttonElement;
        this.usesPagination = usesPagination;
        this.clearSearch = clearSearch;

        this.buttonElement?.on("click", function() {
            thisScope.select();
        });
    }

    get isSelected() {
        return !this.element.hasAttribute("hidden");
    }

    select() {
        var thisScope = this;

        if (this.isSelected) {
            return;
        }

        $g.sel(".home_viewButton").removeClass("selected");
        this.buttonElement?.addClass("selected");

        if (this.clearSearch) {
            $g.sel(".home_appMenuSearchInput").setValue("");
        }

        Promise.all($g.sel(".home_appMenuView", true).fadeOut(250)).then(function() {
            $g.sel(".desktop_appMenuLayout").condition(
                thisScope.usesPagination,
                (element) => element.addClass("paginationViewSelected"),
                (element) => element.removeClass("paginationViewSelected")
            );

            thisScope.element.fadeIn(250);
        });
    }
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
            $g.create("span").condition(
                appDetails.customDisplay,
                (element) => element.add(appDetails.customDisplay),
                (element) => element
                    .addClass("home_appDisplayName")
                    .add(
                        $g.create("span").setText(appDetails.displayName),
                        $g.create("span").setText(appDetails.subtext || "")
                    )
            )
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

export function getSelectedView() {
    return Object.values(views).find((view) => view.isSelected);
}

export function init() {
    scrollers = [];

    views = {
        grid: new View($g.sel(".home_appMenuView.grid"), $g.sel(".home_viewButton.grid"), true),
        alphabetical: new View($g.sel(".home_appMenuView.alphabetical"), $g.sel(".home_viewButton.alphabetical")),
        search: new View($g.sel(".home_appMenuView.search"), null, false, false)
    };

    views.grid.select();

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

    $g.sel(".home_appMenuSearchInput").on("input", function() {
        if (getSelectedView() != views.search) {
            searchLastView = getSelectedView();
        }

        var query = $g.sel(".home_appMenuSearchInput").getValue();
        var results = searcher.search(query);

        if (query == "") {
            searchLastView.select();

            return;
        }

        $g.sel(".home_appMenuView.search").getAll().forEach(function(homeElement) {
            homeElement = $g.sel(homeElement);

            homeElement.clear();

            Object.values(results)
                .map((result) => result.item)
                .forEach(function(app) {
                    homeElement.add(createApp(app));
                })
            ;

            if (results.length > 0) {
                homeElement.add($g.create("div").addClass("home_spacer"));
            }

            homeElement.add(createApp({
                customDisplay: $g.create("span").add(
                    $g.create("span").setText(_("home_searchInSphere_prefix")),
                    $g.create("strong").setText(query),
                    $g.create("span").setText(_("home_searchInSphere_suffix"))
                ),
                url: `gsspecial://sphere?startUrl=${encodeURIComponent(`https://search.liveg.tech/?q=${query}`)}`,
                icon: "gshell://sphere/icon.svg"
            }));
        });

        views.search.select();
    });

    users.onUserStateChange(function(user) {
        if (user != null) {
            load();
        }
    });
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

            Object.values(configData.apps).forEach(function(app) {
                app.displayName = app.name[l10n.currentLocale.localeCode] || app.name[app.fallbackLocale];

                if (Array.isArray(app.shortcuts)) {
                    app.shortcuts.forEach(function(shortcut) {
                        shortcut.displayName = shortcut.name[l10n.currentLocale.localeCode] || shortcut.name[app.fallbackLocale];
                    });
                }
            });

            $g.sel(".home").getAll().forEach(function(homeElement) {
                homeElement = $g.sel(homeElement);

                homeElement.clear();

                $g.sel(".home_appMenuView.alphabetical").clear();

                Object.values(configData.apps).forEach(function(app) {
                    var firstFreePage = homeElement.find(".home_page").filter((page) => page.find(".home_app").items().length < 24);

                    if (firstFreePage.items().length == 0) {
                        firstFreePage = $g.create("div").addClass("home_page");

                        homeElement.add(firstFreePage);
                    }

                    firstFreePage.add(createApp(app));
                });
            });

            $g.sel(".home_appMenuView.alphabetical").getAll().forEach(function(homeElement) {
                homeElement = $g.sel(homeElement);

                homeElement.clear();

                Object.values(configData.apps)
                    .sort((a, b) => l10n.currentLocale.createCollator().compare(a.displayName, b.displayName))
                    .forEach(function(app) {
                        homeElement.add(createApp(app));
                    })
                ;
            });

            var index = [];

            Object.values(configData.apps).forEach(function(app) {
                index.push({
                    ...app,
                    type: searchResultTypes.APP,
                    searchTerm: app.displayName
                });

                if (Array.isArray(app.shortcuts)) {
                    app.shortcuts.forEach(function(shortcut) {
                        index.push({
                            ...app,
                            type: searchResultTypes.SHORTCUT,
                            displayName: shortcut.displayName,
                            subtext: app.displayName,
                            url: shortcut.url,
                            searchTerm: shortcut.displayName
                        })
                    });
                }
            });

            searcher = new Fuse(index, {
                keys: ["searchTerm"]
            });

            scrollers.forEach(function(scroller, i) {
                scroller.applyPagination($g.sel($g.sel(".home_pagination").getAll()[i]));
            });
        });
    });
}