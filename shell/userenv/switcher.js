/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as screenScroll from "gshell://helpers/screenscroll.js";

export var main = null;

export class Switcher extends screenScroll.ScrollableScreen {
    constructor(element) {
        super(element);
    }

    selectScreen(screen) {
        if (this.element.get().matches(".allowSelect")) {
            this.element.removeClass("allowSelect");
            this.element.find(":scope > *").removeClass("selected");

            screen.addClass("selected");

            this.screenSelected = true;
            this.targetScrollX = screen.get().offsetLeft;
        }
    }

    deselectScreen() {
        this.screenSelected = false;

        this.element.addClass("allowSelect");
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
        $g.create("div").addClass("switcher_app").add(
            $g.create("main").add(
                $g.create("webview").setAttribute("src", "https://livegtech.github.io/Adapt-UI/demos/all/")
            )
        )
    );

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