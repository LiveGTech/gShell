/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as calc from "gshell://lib/adaptui/src/calc.js";
import * as markup from "gshell://lib/adaptui/src/markup.js";

import * as l10n from "gshell://config/l10n.js";
import * as input from "gshell://input/input.js";
import * as switcher from "gshell://userenv/switcher.js";
import * as appManager from "gshell://userenv/appmanager.js";
import * as webviewManager from "gshell://userenv/webviewmanager.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

export const FULL_CHROME_MIN_WIDTH = calc.getRemSize(30);

export class Browser {
    constructor() {
        this.screenElement = null;
        this.appElement = null;
        this.isFullChrome = false;
        this.lastTitle = null;
        this.lastIcon = null;
    }

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

    get webview() {
        return this.uiMain.find("webview");
    }

    get tabCount() {
        return switcher.getWindowAppCount(this.screenElement);
    }

    updateChrome() {
        this.uiChrome.find(".sphere_tabButton").setText(this.tabCount > 99 ? ":)" : this.tabCount); // EASTEREGG: In a similar vein to mobile Chromium...

        if (
            this.webview.is(".sphere_ready") &&
            !this.isFullChrome &&
            document.activeElement !== this.uiChrome.find(".sphere_addressInput").get()
        ) {
            this.uiChrome.find(".sphere_addressInput").setValue(this.constructor.getUrlPreview(this.webview.get()?.getURL()));
        } else {
            this.uiChrome.find(".sphere_addressInput").setValue(this.webview.get()?.getURL());
        }
    }

    spawnWebview(url) {
        var thisScope = this;

        return webviewManager.spawnAsUser(this.constructor.normaliseUrl(url)).then(function(webview) {
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

            webview.on("page-title-updated", function(event) {
                thisScope.lastTitle = event.title;

                if (thisScope.appElement == null) {
                    return;
                }

                switcher.setAppCustomTab(thisScope.appElement, thisScope.lastTitle, thisScope.lastIcon);
            });

            webview.on("page-favicon-updated", function(event) {
                thisScope.lastIcon = event.favicons[0];

                if (thisScope.appElement == null) {
                    return;
                }

                switcher.setAppCustomTab(thisScope.appElement, thisScope.lastTitle, thisScope.lastIcon);
            });
    
            thisScope.uiMain.add(webview);
    
            thisScope.updateChrome();
        });
    }

    goBack() {
        this.webview.get()?.goBack();
    }

    goForward() {
        this.webview.get()?.goForward();
    }

    reload() {
        this.webview.get()?.reload();
    }

    visitUrl(url) {
        this.webview.get()?.loadURL(this.constructor.normaliseUrl(url));
    }

    installApp() {
        var url = this.webview.get()?.getURL();

        if (!url) {
            return;
        }

        gShell.call("webview_getManifest", {
            webContentsId: this.webview.get().getWebContentsId()
        }).then(function(data) {
            var manifestData = appManager.ManifestData.deserialise(data);

            if (manifestData.isValid) {
                return appManager.installFromManifestData(manifestData);
            }

            var localeCode = l10n.currentLocale.localeCode;

            return appManager.install({
                fallbackLocale: localeCode,
                name: {
                    [localeCode]: this.lastTitle
                },
                url,
                icon: this.lastIcon
            });
        });
    }

    openOptionsMenu() {
        var thisScope = this;

        $g.sel(".sphere_optionsMenu").clear().add(
            $g.create("button")
                .setText(_("sphere_menu_installApp"))
                .on("click", function() {
                    thisScope.installApp();
                })
        );

        markup.apply($g.sel(".sphere_optionsMenu").get());

        return $g.sel(".sphere_optionsMenu").menuOpen();
    }

    render() {
        var thisScope = this;

        this.uiContainer = $g.create("div").addClass("sphere");

        // UI chrome, not to be confused with the Google Chrome browser
        this.uiChrome = $g.create("header").add(
            $g.create("button")
                .setAttribute("title", _("sphere_back"))
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
                .setAttribute("title", _("sphere_forward"))
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
            $g.create("button")
                .addClass("sphere_fullChromeOnly")
                .setAttribute("title", _("sphere_reload"))
                .setAttribute("aria-label", _("sphere_reload"))
                .on("click", function() {
                    thisScope.reload();
                })
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "dark embedded")
                        .setAttribute("src", "gshell://lib/adaptui/icons/refresh.svg")
                        .setAttribute("alt", "")
                )
            ,
            $g.create("input")
                .addClass("sphere_addressInput")
                .setAttribute("type", "url")
                .on("click", function() {
                    thisScope.uiChrome.find(".sphere_addressInput").setValue(thisScope.webview.get()?.getURL());

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
                .on("click", function() {
                    switcher.showTabList(thisScope.screenElement);
                })
            ,
            $g.create("button")
                .setAttribute("aria-label", _("sphere_menu"))
                .on("click", function() {
                    thisScope.openOptionsMenu();
                })
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "dark embedded")
                        .setAttribute("src", "gshell://lib/adaptui/icons/menu.svg")
                        .setAttribute("alt", "")
                )
        );

        this.uiMain = $g.create("main");

        this.spawnWebview("https://search.liveg.tech");

        new ResizeObserver(function() {
            thisScope.isFullChrome = thisScope.uiContainer.get().clientWidth >= FULL_CHROME_MIN_WIDTH;

            if (thisScope.isFullChrome) {
                thisScope.uiContainer.addClass("fullChrome");
            } else {
                thisScope.uiContainer.removeClass("fullChrome");
            }

            thisScope.updateChrome();
        }).observe(this.uiContainer.get());

        return this.uiContainer.add(
            this.uiChrome,
            this.uiMain
        );
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

    var details = {
        name: _("sphere"),
        icon: "gshell://sphere/icon.svg",
        instantLaunch: true,
        showTabs: true,
        newTabHandler: function(screenElement) {
            var browser = new Browser();

            browser.screenElement = screenElement;
            browser.appElement = switcher.addAppToWindow(screenElement, browser.render(), details);
        }
    };

    return switcher.openWindow(browser.render(), details, function(screenElement, appElement) {
        browser.screenElement = screenElement;
        browser.appElement = appElement;
    });
}