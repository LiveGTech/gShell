/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as dismiss from "gshell://lib/adaptui/src/dismiss.js";
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

// TODO: Accept URL to open a specific app
export function openApp() {
    showList();

    var screenElement = $g.create("div").addClass("switcher_screen").add(
        $g.create("div").addClass("switcher_apps").add(
            $g.create("div").addClass("switcher_app").add(
                $g.create("main").add(
                    $g.create("webview").setAttribute("src", "https://livegtech.github.io/Adapt-UI/demos/all/")
                )
            )
        ),
        $g.create("button")
            .addClass("switcher_screenButton")
            .setAttribute("aria-label", "Screen") // TODO: Find name of screen and use that as label
            .on("focus", function() {
                if (!main.screenSelected) {
                    main.targetScrollX = screenElement.get().offsetLeft;
                }
            })
            .on("click", function() {
                main.selectScreen(screenElement);

                screenElement.find(".switcher_apps").focus();
            })
    );

    screenElement.find(".switcher_apps *").on("focus", function() {
        screenElement.find(".switcher_screenButton").focus();
    });

    screenElement.on("dismiss", function() {
        Promise.all([screenElement.collapse(false), screenElement.fadeOut()]).then(function() {
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
    return $g.sel("#main").screenFade();
}