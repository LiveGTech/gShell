/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as dismiss from "gshell://lib/adaptui/src/dismiss.js";
import * as a11y from "gshell://lib/adaptui/src/a11y.js";

import * as device from "gshell://system/device.js";
import * as screenScroll from "gshell://helpers/screenscroll.js";
import * as webviewManager from "gshell://userenv/webviewmanager.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

export var main = null;

var topmostZIndex = 1;

export class Switcher extends screenScroll.ScrollableScreen {
    constructor(element) {
        super(element);

        var thisScope = this;

        setInterval(function() {
            thisScope.element.find(".switcher_screen").getAll().forEach(function(screenElement) {
                if (screenElement.querySelector(".switcher_apps").contains(document.activeElement) && !$g.sel(screenElement).hasClass("switcher_screen_selected")) {
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

        if (screenElement.get().matches(".switcher_screen") && (this.element.get().matches(".allowSelect") || device.data?.type == "desktop")) {
            this.element.removeClass("allowSelect");
            this.element.find(":scope > *").removeClass("switcher_screen_selected");

            screenElement.addClass("switcher_screen_selected");

            this.screenSelected = true;
            this.targetScrollX = screenElement.get().offsetLeft;

            thisScope.element.find(":scope > *").getAll().forEach((element) => setWindowGeometry($g.sel(element)));

            if (device.data?.type == "desktop") {
                screenElement.setStyle("z-index", topmostZIndex++);
            }

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
        this.element.find(":scope > *").removeClass("switcher_screen_selected");

        this.element.find(":scope > *").setStyle("position", null);
        this.element.find(":scope > *").setStyle("top", null);
        this.element.find(":scope > *").setStyle("left", null);
    }
}

export function init() {
    $g.sel(".switcher_home").on("click", function() {
        goHome();
    });

    $g.sel(".switcher_showList").on("click", function() {
        showList();
    });

    main = new Switcher($g.sel(".switcher"));
}

export function getWindowGeometry(element) {
    if (element.hasAttribute("data-geometry")) {
        return JSON.parse(element.getAttribute("data-geometry"));
    }

    return {};
}

export function setWindowGeometry(element, geometry = getWindowGeometry(element)) {
    if (device.data?.type != "desktop") {
        return;
    }

    element.setAttribute("data-geometry", JSON.stringify(geometry));

    element.setStyle("left", `${geometry.x || 0}px`);
    element.setStyle("top", `${geometry.y || 0}px`);
}

export function openWindow(windowContents, appName = null) {
    showList();

    var initialX = 0;
    var initialY = 0;
    var pointerDown = false;
    var pointerStartX = 0;
    var pointerStartY = 0;
    var shouldSelectScreen = false;

    $g.sel("body").on("pointerup", function(event) {
        $g.sel("#switcherView .switcher").removeClass("manipulating");

        pointerDown = false;
    });

    $g.sel("body").on("pointermove", function(event) {
        if (pointerDown) {
            setWindowGeometry(screenElement, {
                ...getWindowGeometry(screenElement),
                x: initialX + (event.pageX - pointerStartX),
                y: initialY + (event.pageY - pointerStartY)
            });
        }
    });

    var screenElement = $g.create("div")
        .addClass("switcher_screen")
        .add(
            $g.create("div")
                .addClass("switcher_titleBar")
                .on("pointerdown", function(event) {
                    $g.sel("#switcherView .switcher").addClass("manipulating");

                    initialX = screenElement.get().offsetLeft;
                    initialY = screenElement.get().offsetTop;
                    pointerDown = true;
                    pointerStartX = event.pageX;
                    pointerStartY = event.pageY;
                })
                .add(
                    $g.create("span").setText("App")
                )
            ,
            $g.create("div")
                .addClass("switcher_apps")
                .add(
                    $g.create("div").addClass("switcher_app").add(...windowContents)
                )
            ,
            $g.create("button")
                .addClass("switcher_screenButton")
                .setAttribute("aria-label", "")
                .on("focus", function() {
                    if (!main.screenSelected) {
                        main.targetScrollX = screenElement.get().offsetLeft;
                    }
                })
                .on("click", function() {
                    shouldSelectScreen = true;
                })
                .on("keydown", function(event) {
                    if (event.key == " ") {
                        main.selectScreen(screenElement);

                        screenElement.find(".switcher_apps").focus();

                        shouldSelectScreen = false;
                    }
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
            $g.create("div")
                .addClass("switcher_screenOptions").add(
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
        )
    ;

    if (appName == null) {
        screenElement.on("page-title-updated", function(event) {
            screenElement.find(".switcher_screenButton").setAttribute("aria-label", event.title);
        });
    } else {
        screenElement.find(".switcher_screenButton").setAttribute("aria-label", appName);
    }

    screenElement.find(".switcher_apps *").on("focus", function() {
        screenElement.find(".switcher_screenButton").focus();
    });

    if (device.data?.type == "desktop") {
        screenElement.on("pointerdown", function(event) {
            if ($g.sel(event.target).is(".switcher_screenButton, .switcher_screenCloseButton, .switcher_screenOptions")) {
                return;
            }

            main.selectScreen(screenElement);
        });

        screenElement.on("webviewevent", function(event) {
            if (event.detail.type == "pointerdown") {
                main.selectScreen(screenElement);
            }
        });
    }

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

    screenElement.on("dismissreturnend", function(event) {
        if (shouldSelectScreen && !screenElement.is(".closing")) {
            main.selectScreen(screenElement);

            screenElement.find(".switcher_apps").focus();
        }

        shouldSelectScreen = false;
    });

    screenElement.swipeToDismiss(device.data?.type == "desktop" ? dismiss.directions.VERTICAL : dismiss.directions.UP);

    $g.sel("#switcherView .switcher").add(screenElement);

    return $g.sel("#switcherView").screenFade();
}

export function openApp(url) {
    return openWindow([$g.create("main").add(webviewManager.spawn(url))]);
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