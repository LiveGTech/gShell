/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as calc from "gshell://lib/adaptui/src/calc.js";

import * as input from "gshell://input/input.js";
import * as switcher from "gshell://userenv/switcher.js";
import * as webviewManager from "gshell://userenv/webviewmanager.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

export const FULL_CHROME_MIN_WIDTH = calc.getRemSize(30);

export class Browser {
    constructor() {}

    static normaliseUrl(url) {
        if (url.match(/^localhost:\d+/)) {
            return `http://${url}`;
        }

        if (url.match(/^[a-zA-Z][a-zA-Z.+-]*:.*/)) {
            return url;
        }

        return `http://${url}`;
    }

    static getUrlPreview(url, mode = "domain") {
        switch (mode) {
            case "domain":
                return url.match(/^[a-z.+-]+:\/*([^\/]+)/)?.[1] || url;

            default:
                return url;
        }
    }

    get tabCount() {
        return this.uiMain.find(".sphere_tabs .sphere_tab").getAll().length;
    }

    get selectedTab() {
        return this.uiMain.find(".sphere_tab_selected");
    }

    updateChrome() {
        this.uiChrome.find(".sphere_tabButton").setText(this.tabCount > 99 ? ":)" : this.tabCount); // EASTEREGG: In a similar vein to mobile Chromium...

        if (this.selectedTab.find("webview").is(".sphere_ready") && document.activeElement !== this.uiChrome.find(".sphere_addressInput").get()) {
            this.uiChrome.find(".sphere_addressInput").setValue(this.constructor.getUrlPreview(this.selectedTab.find("webview").get()?.getURL()));
        }
    }

    newTab(url) {
        var thisScope = this;
        var webview = webviewManager.spawn(this.constructor.normaliseUrl(url));

        webview.on("dom-ready", function() {
            webview.addClass("sphere_ready");

            thisScope.updateChrome();
        });

        webview.on("did-navigate did-navigate-in-page", function() {
            thisScope.updateChrome();
        });

        webview.on("click focus", function() {
            thisScope.uiChrome.find(".sphere_addressInput").blur();
            webview.focus();

            thisScope.updateChrome();
        });

        this.uiMain.find(".sphere_tabs").add(
            $g.create("div")
                .addClass("sphere_tab")
                .addClass("sphere_tab_selected")
                .add(webview)
        );

        this.updateChrome();
    }

    goBack(tab = this.selectedTab) {
        tab.find("webview").get()?.goBack();
    }

    goForward(tab = this.selectedTab) {
        tab.find("webview").get()?.goForward();
    }

    visitUrl(url, tab = this.selectedTab) {
        tab.find("webview").get()?.loadURL(this.constructor.normaliseUrl(url));
    }

    render() {
        var thisScope = this;

        this.uiContainer = $g.create("div").addClass("sphere");

        // UI chrome, not to be confused with the Google Chrome browser
        this.uiChrome = $g.create("header").add(
            $g.create("button")
                .setAttribute("aria-label", _("sphere_back"))
                .on("click", function() {
                    thisScope.goBack();
                })
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "dark embedded")
                        .setAttribute("src", "gshell://lib/adaptui/icons/back.svg")
                        .setAttribute("alt", "")
                )
            ,
            $g.create("button")
                .addClass("sphere_fullChromeOnly")
                .setAttribute("aria-label", _("sphere_forward"))
                .on("click", function() {
                    thisScope.goForward();
                })
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "dark embedded")
                        .setAttribute("src", "gshell://lib/adaptui/icons/forward.svg")
                        .setAttribute("alt", "")
                )
            ,
            $g.create("input")
                .addClass("sphere_addressInput")
                .setAttribute("type", "url")
                .on("click", function() {
                    thisScope.uiChrome.find(".sphere_addressInput").setValue(thisScope.selectedTab.find("webview").get()?.getURL());

                    thisScope.uiChrome.find(".sphere_addressInput").get().select();
                })
                .on("keydown", function(event) {
                    if (event.key == "Enter") {
                        thisScope.visitUrl(thisScope.uiChrome.find(".sphere_addressInput").getValue());
                    }
                })
            ,
            $g.create("button")
                .addClass("sphere_tabButton")
                .setText("0")
            ,
            $g.create("button")
                .setAttribute("aria-label", _("sphere_menu"))
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "dark embedded")
                        .setAttribute("src", "gshell://lib/adaptui/icons/menu.svg")
                        .setAttribute("alt", "")
                )
        );

        this.uiMain = $g.create("main").add(
            $g.create("div").addClass("sphere_tabs")
        );

        this.newTab("https://github.com/LiveGTech/gShell");

        new ResizeObserver(function() {
            if (thisScope.uiContainer.get().clientWidth >= FULL_CHROME_MIN_WIDTH) {
                thisScope.uiContainer.addClass("fullChrome");
            } else {
                thisScope.uiContainer.removeClass("fullChrome");
            }
        }).observe(this.uiContainer.get());

        return this.uiContainer.add(this.uiChrome, this.uiMain);
    }
}

export function init() {
    webviewComms.onEvent("click", function(event) {
        if (!event.isTrusted) {
            return;
        }

        if ($g.sel(document.activeElement).is(".sphere_addressInput")) {
            $g.sel("body").focus();

            input.hide(true);
        }
    });
}

export function openBrowser() {
    var browser = new Browser();

    return switcher.openWindow(browser.render(), {
        name: _("sphere"),
        icon: "gshell://sphere/icon.svg"
    });
}