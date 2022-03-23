/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as dismiss from "gshell://lib/adaptui/src/dismiss.js";
import * as animations from "gshell://lib/adaptui/src/animations.js";
import * as a11y from "gshell://lib/adaptui/src/a11y.js";

import * as screenScroll from "gshell://helpers/screenscroll.js";

export var main = null;

export class Switcher extends screenScroll.ScrollableScreen {
    constructor(element) {
        super(element);

        var thisScope = this;

        setInterval(function() {
            thisScope.element.find(".switcher_screen").getAll().forEach(function(screenElement) {
                if (screenElement.querySelector(".switcher_apps").contains(document.activeElement) && !$g.sel(screenElement).hasClass("selected")) {
                    $g.sel(screenElement).find(".switcher_screenButton").focus();
                }
            });
        });
    }

    get screenWidth() {
        return this.element.find(":scope > *").get().clientWidth * 0.7; // 0.7 as the percentage used from the scale transform
    }

    selectScreen(screenElement) {
        var thisScope = this;

        if (screenElement.get().matches(".switcher_screen") && this.element.get().matches(".allowSelect")) {
            this.element.removeClass("allowSelect");
            this.element.find(":scope > *").removeClass("selected");

            screenElement.addClass("selected");

            this.screenSelected = true;
            this.targetScrollX = screenElement.get().offsetLeft;

            setTimeout(function() {
                thisScope.element.find(":scope > *").addClass("backgrounded");
                screenElement.removeClass("backgrounded");
            }, a11y.prefersReducedMotion() ? 0 : 500);
        }
    }

    deselectScreen() {
        this.screenSelected = false;
        this.scrolling = false;

        this.element.addClass("allowSelect");
        this.element.find(":scope > *").removeClass("backgrounded");
        this.element.find(":scope > *").removeClass("selected");
    }
}

export function init() {
    $g.sel(".switcher_home").on("click", function() {
        goHome();
    });

    main = new Switcher($g.sel(".switcher"));
}

export function openApp(url) {
    showList();

    var webview = $g.create("webview");

    var screenElement = $g.create("div").addClass("switcher_screen").add(
        $g.create("div").addClass("switcher_apps").add(
            $g.create("div").addClass("switcher_app").add(
                $g.create("main").add(
                    webview.setAttribute("src", url)
                )
            )
        ),
        $g.create("button")
            .addClass("switcher_screenButton")
            .setAttribute("aria-label", "")
            .on("focus", function() {
                if (!main.screenSelected) {
                    main.targetScrollX = screenElement.get().offsetLeft;
                }
            })
            .on("click", function() {
                main.selectScreen(screenElement);

                screenElement.find(".switcher_apps").focus();
            })
        ,
        $g.create("button")
            .addClass("switcher_screenCloseButton")
            .setAttribute("aria-label", _("switcher_close"))
            .on("click", function() {
                screenElement.addClass("closing");

                screenElement.easeStyleTransition("opacity", 0).then(function() {
                    return screenElement.collapse(false);
                }).then(function() {
                    screenElement.remove();
                });
            })
            .add(
                $g.create("img")
                    .setAttribute("aui-icon", "light")
                    .setAttribute("src", "gshell://lib/adaptui/icons/close.svg")
                    .setAttribute("alt", "")
            )
        ,
        $g.create("div").addClass("switcher_screenOptions").add(
            $g.create("button")
                .on("click", function() {
                    $g.sel(".switcher_screen").fadeOut().then(function() {
                        closeAll();
                    });
                })
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "light")
                        .setAttribute("src", "gshell://lib/adaptui/icons/close.svg")
                        .setAttribute("alt", "")
                    ,
                    $g.create("span").setText(_("switcher_closeAll"))
                )
        )
    );

    webview.on("page-title-updated", function(event) {
        screenElement.find(".switcher_screenButton").setAttribute("aria-label", event.title);
    });

    screenElement.find(".switcher_apps *").on("focus", function() {
        screenElement.find(".switcher_screenButton").focus();
    });

    screenElement.on("dismissintent", function(event) {
        if (main.screenSelected) {
            event.preventDefault();
        }
    });

    screenElement.on("dismiss", function() {
        screenElement.addClass("closing");

        Promise.all([
            screenElement.collapse(false),
            screenElement.easeStyleTransition("opacity", 0)
        ]).then(function() {
            screenElement.remove();
        });
    });

    screenElement.swipeToDismiss(dismiss.directions.UP);

    $g.sel("#switcherView .switcher").add(screenElement);

    return $g.sel("#switcherView").screenFade();
}

export function showList() {
    main.deselectScreen();
}

export function selectScreen(screenElement) {
    main.selectScreen(screenElement);

    return Promise.resolve();
}

export function closeAll() {
    $g.sel(".switcher_screen").remove();
}

export function goHome() {
    return $g.sel("#home").screenFade();
}