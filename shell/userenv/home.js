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

var scroller = null;

export function init() {
    $g.sel(".home").getAll().forEach(function(homeElement) {
        homeElement = $g.sel(homeElement);

        scroller = new screenScroll.ScrollableScreen(homeElement);

        homeElement.on("focusin", function(event) {
            var target = $g.sel(event.target);

            if (target.is(".home_page *")) {
                scroller.targetScrollX = target.ancestor(".home_page").get().offsetLeft;
            }
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

            switcher.openApp(appDetails.url);
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
        
                homeElement.clear().add(
                    $g.create("div")
                        .addClass("home_page")
                        .add(
                            ...Object.values(configData.apps).map((app) => createApp({
                                ...app,
                                name: app.name[l10n.currentLocale.localeCode] || app.name[app.fallbackLocale]
                            }))
                        )
                    ,
                    $g.create("div")
                        .addClass("home_page")
                        .add(
                            ...new Array(24).fill(null).map(() => createApp({name: "Debug", icon: "gshell://media/logo.svg"})
                                .on("click", function() {
                                    $g.sel("#main").screenFade();
                                })
                            )
                        )
                );
            });
        });
    });
}