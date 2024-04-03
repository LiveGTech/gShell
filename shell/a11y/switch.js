/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as aui_a11y from "gshell://lib/adaptui/src/a11y.js";

import * as a11y from "gshell://a11y/a11y.js";
import * as input from "gshell://input/input.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

export const NAME = "switch";

export var modes = {
    ITEM_SCAN: 0,
    POINT_SCAN: 1
};

export var menus = {
    NONE: 0,
    MAIN: 1,
    QUICK_SETTINGS: 2,
    POINT_SCAN: 3
};

export class SwitchNavigation extends a11y.AssistiveTechnology {
    constructor() {
        super();

        this.currentMode = modes.ITEM_SCAN;
        this._currentMenu = menus.NONE;

        this.itemScanNextAt = -Infinity;

        this.lastPointScanAdvance = -Infinity;
        this.pointScanX = 0;
        this.pointScanY = 0;
        this.pointScanRefinementX = 0;
        this.pointScanRefinementY = 0;
        this.pointScanTargetX = 0;
        this.pointScanTargetY = 0;
        this.pointScanAxisIsY = false;
        this.pointScanAdvancingNegative = false;
        this.pointScanRefining = true;
        this.pointScanRefiningIsY = false;
    }

    get currentMenu() {
        return this._currentMenu;
    }

    set currentMenu(value) {
        this._currentMenu = value;

        this.renderMenu();
    }

    init() {
        var thisScope = this;

        function keydownCallback(event) {
            if (!a11y.options.switch_enabled) {
                return;
            }

            if (input.showing) {
                if (event.key == " ") {
                    thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanAfterConfirmPeriod;
                }

                return;
            }

            switch (event.key) {
                case " ":
                    if (input.isTextualInput($g.sel(document.activeElement))) {
                        event.preventDefault();

                        input.show();
                    }

                    if (thisScope.currentMode == modes.ITEM_SCAN) {
                        thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanAfterConfirmPeriod;
                    }

                    if (thisScope.currentMode == modes.POINT_SCAN) {
                        if (!thisScope.pointScanAxisIsY && thisScope.pointScanRefining) { // Refining X
                            thisScope.pointScanRefining = false;
                            thisScope.pointScanRefinementX = thisScope.pointScanX;
                            thisScope.pointScanX = 0;
                        } else if (!thisScope.pointScanAxisIsY) { // Selecting X
                            thisScope.pointScanRefining = true;
                            thisScope.pointScanAxisIsY = true;
                        } else if (thisScope.pointScanRefining) { // Refining Y
                            thisScope.pointScanRefining = false;
                            thisScope.pointScanRefinementY = thisScope.pointScanY;
                            thisScope.pointScanY = 0;
                        } else { // Selecting Y
                            $g.sel(".a11y_switch_pointScanAxis, .a11y_switch_pointScanRefiner").hide();

                            thisScope.showPointMarker();

                            thisScope.currentMode = modes.ITEM_SCAN;
                            thisScope.currentMenu = menus.POINT_SCAN;
                        }
                    }

                    break;
            }
        }

        $g.sel("body").on("keydown", keydownCallback);
        webviewComms.onEvent("keydown", keydownCallback);

        $g.sel(".a11y_switch_openMainMenuButton").on("click", function() {
            thisScope.currentMenu = menus.MAIN;
        });

        $g.sel("body").on("keydown", function(event) {
            if (!a11y.options.switch_enabled) {
                return;
            }

            if (event.target.matches("[aria-role='group']")) {
                if (event.key == "Tab") {
                    $g.sel(event.target).find("*").setAttribute("tabindex", "-1");
                }

                if (event.key == " ") {
                    $g.sel(event.target).find("*").removeAttribute("tabindex");

                    event.target.querySelector(aui_a11y.FOCUSABLES)?.focus();
                }

                return;
            }

            if (event.key == " " && event.target.matches("a")) {
                event.target.click();
    
                event.preventDefault();
            }
        });

        var switchWasEnabled = false;

        setInterval(function() {
            if (!a11y.options.switch_enabled) {
                $g.sel("[aria-role='group']").removeAttribute("tabindex");

                switchWasEnabled = false;

                return;
            }

            if (!switchWasEnabled) {
                thisScope.currentMode = modes.ITEM_SCAN;
            }

            switchWasEnabled = true;

            $g.sel("[aria-role='group']").setAttribute("tabindex", "0");

            if (thisScope.currentMode == modes.ITEM_SCAN) {
                if (Date.now() - thisScope.itemScanNextAt < a11y.options.switch_itemScanPeriod) {
                    return;
                }

                gShell.call("io_input", {webContentsId: input.showing ? 1 : input.getWebContentsId(), event: {type: "keyDown", keyCode: "tab", modifiers: []}});
                gShell.call("io_input", {webContentsId: input.showing ? 1 : input.getWebContentsId(), event: {type: "keyUp", keyCode: "tab", modifiers: []}});

                thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanPeriod;
            }

            if (thisScope.currentMode == modes.POINT_SCAN) {
                // FIXME: Point scanning causes unexpected behaviour when an item is programmatically focused (such as in OOBS when going between screens)

                var advanceRate = thisScope.lastPointScanAdvance == -Infinity ? 0 : (Date.now() - thisScope.lastPointScanAdvance) * 0.25;

                if (thisScope.pointScanAxisIsY) {
                    thisScope.pointScanY += (thisScope.pointScanAdvancingNegative ? -1 : 1) * advanceRate;
                } else {
                    thisScope.pointScanX += (thisScope.pointScanAdvancingNegative ? -1 : 1) * advanceRate;
                }

                if (thisScope.pointScanX < 0 || thisScope.pointScanY < 0) {
                    thisScope.pointScanAdvancingNegative = false;
                } else if (
                    (!thisScope.pointScanAxisIsY && thisScope.pointScanX > window.innerWidth - (thisScope.pointScanRefining ? (0.1 * window.innerHeight) : 0)) ||
                    (thisScope.pointScanAxisIsY && thisScope.pointScanY > window.innerHeight - (thisScope.pointScanRefining ? (0.1 * window.innerWidth) : 0))
                ) {
                    thisScope.pointScanAdvancingNegative = true;
                }

                var refinementPositionX = (thisScope.pointScanRefining && !thisScope.pointScanAxisIsY) ? thisScope.pointScanX : thisScope.pointScanRefinementX;
                var refinementPositionY = thisScope.pointScanRefining ? thisScope.pointScanY : thisScope.pointScanRefinementY;

                thisScope.pointScanTargetX = refinementPositionX + ((thisScope.pointScanX / window.innerWidth) * 0.1 * window.innerHeight);
                thisScope.pointScanTargetY = refinementPositionY + ((thisScope.pointScanY / window.innerHeight) * 0.1 * window.innerWidth);

                $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='x']").setStyle("left", `${refinementPositionX}px`);
                $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='y']").setStyle("top", `${refinementPositionY}px`);

                $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='x']").setStyle("left", `${thisScope.pointScanTargetX}px`);
                $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='y']").setStyle("top", `${thisScope.pointScanTargetY}px`);

                $g.sel(".a11y_switch_pointScanAxis, .a11y_switch_pointScanRefiner").hide();

                if (!thisScope.pointScanAxisIsY) {
                    $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='x']").show();

                    if (!thisScope.pointScanRefining) {
                        $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='x']").show();
                    }
                }

                if (thisScope.pointScanAxisIsY) {
                    $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='x']").show();
                    $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='y']").show();

                    if (!thisScope.pointScanRefining) {
                        $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='y']").show();
                    }
                }

                thisScope.lastPointScanAdvance = Date.now();
            } else {
                $g.sel(".a11y_switch_pointScanAxis, .a11y_switch_pointScanRefiner").hide();
            }
        });
    }

    update() {
        $g.sel("body").setAttribute("liveg-a11y-switch", a11y.options.switch_enabled);
        $g.sel("body").setAttribute("sphere-a11yscancolour", a11y.options.switch_enabled ? a11y.options.switch_scanColour : "");
    }

    startPointScan() {
        this.currentMode = modes.POINT_SCAN;
        this.lastPointScanAdvance = Date.now();
        this.pointScanX = 0;
        this.pointScanY = 0;
        this.pointScanRefinementX = 0;
        this.pointScanRefinementY = 0;
        this.pointScanAxisIsY = false;
        this.pointScanAdvancingNegative = false;
        this.pointScanRefining = true;
        this.pointScanRefiningIsY = false;

        setTimeout(function() {
            gShell.call("io_focus", {webContentsId: 1}).then(function() {
                if (input.showing) {
                    return;
                }

                $g.sel(document.activeElement).blur();
                $g.sel("body").focus();
            });
        });
    }

    startItemScan() {
        this.currentMode = modes.ITEM_SCAN;

        $g.sel(".a11y_switch_pointScanAxis, .a11y_switch_pointScanRefiner").hide();
    }

    renderMenu() {
        var thisScope = this;

        if (this.currentMenu == menus.NONE) {
            $g.sel(".a11y_switch_menu").hide();

            aui_a11y.clearFocusTrap();

            return;
        }

        function createMenuItem(text, icon, action = function() {}) {
            return $g.create("button")
                .setAttribute("aria-label", text)
                .on("click", action)
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "dark embedded")
                        .setAttribute("src", `gshell://lib/adaptui/icons/${icon}.svg`)
                    ,
                    $g.create("span").setText(text)
                )
            ;
        }

        function setMenuItems(items) {
            $g.sel(".a11y_switch_menu").clear();

            var row = $g.create("div");

            for (var i = 0; i < items.length; i++) {
                row.add(items[i]);

                if (i % 4 == 3) {
                    $g.sel(".a11y_switch_menu").add(row);

                    row = $g.create("div");
                }
            }

            $g.sel(".a11y_switch_menu").add(row);
        }

        function closeMenu() {
            thisScope.currentMenu = menus.NONE;
        }

        this.itemScanNextAt = Date.now() + a11y.options.switch_itemScanAfterConfirmPeriod;

        switch (this._currentMenu) {
            case menus.MAIN:
                setMenuItems([
                    createMenuItem(_("a11y_switch_switchToPointScan"), "point", function() {
                        closeMenu();

                        thisScope.startPointScan();
                    }),
                    createMenuItem(_("a11y_switch_quickSettings"), "quicksettings", function() {
                        thisScope.currentMenu = menus.QUICK_SETTINGS;
                    })
                ]);

                break;

            case menus.QUICK_SETTINGS:
                setMenuItems([
                    createMenuItem(_("a11y_switch_scanSlower"), "remove", function() {
                        if (a11y.options.switch_itemScanPeriod + 100 > 1_000) {
                            return;
                        }

                        a11y.setOption("switch_itemScanPeriod", a11y.options.switch_itemScanPeriod + 100);
                    }),
                    createMenuItem(_("a11y_switch_scanFaster"), "add", function() {
                        if (a11y.options.switch_itemScanPeriod - 100 < 100) {
                            return;
                        }

                        a11y.setOption("switch_itemScanPeriod", a11y.options.switch_itemScanPeriod - 100);
                    }),
                    createMenuItem(_("a11y_switch_done"), "checkmark", closeMenu)
                ]);

                break;

            case menus.POINT_SCAN:
                setMenuItems([
                    createMenuItem(_("a11y_switch_click"), "gesture", function() {
                        thisScope.hidePointMarker();

                        closeMenu();

                        var targetSurface = document.body;
                        var targetWebContentsId = 1;

                        function computeZIndex(element) {
                            if (!(element instanceof Element)) {
                                return 0;
                            }

                            if ($g.sel(element).is(".switcher_screen *")) {
                                element = $g.sel(element).ancestor(".switcher_screen").get();
                            }

                            if ($g.sel(element).is("aui-menu, aui-menu *")) {
                                return Infinity;
                            }

                            return Number(getComputedStyle(element).zIndex);
                        }

                        $g.sel("*")
                            .getAll()
                            .sort((a, b) => computeZIndex(a) - computeZIndex(b))
                            .forEach(function(element) {
                                if (getComputedStyle(element).pointerEvents == "none") {
                                    return;
                                }

                                var surfaceRect = element.getBoundingClientRect();

                                if (
                                    surfaceRect.left <= thisScope.pointScanTargetX &&
                                    surfaceRect.right > thisScope.pointScanTargetX &&
                                    surfaceRect.top <= thisScope.pointScanTargetY &&
                                    surfaceRect.bottom > thisScope.pointScanTargetY
                                ) {
                                    if ($g.sel(element).is("webview")) {
                                        targetSurface = element;
                                        targetWebContentsId = element.getWebContentsId();
                                    } else {
                                        targetSurface = document.body;
                                        targetWebContentsId = 1;
                                    }
                                }
                            })
                        ;

                        var promiseChain = Promise.resolve();
                        var surfaceRect = targetSurface.getBoundingClientRect();

                        $g.sel(targetSurface).focus();

                        ["mouseDown", "mouseUp"].forEach(function(type) {
                            promiseChain = promiseChain.then(function() {
                                return gShell.call("io_input", {webContentsId: targetWebContentsId, event: {
                                    type,
                                    x: Math.round(thisScope.pointScanTargetX - surfaceRect.left) * window.devicePixelRatio,
                                    y: Math.round(thisScope.pointScanTargetY - surfaceRect.top) * window.devicePixelRatio,
                                    button: "left",
                                    clickCount: 1
                                }});
                            });
                        });

                        promiseChain = promiseChain.then(function() {
                            if (input.showing) {
                                return;
                            }

                            thisScope.startPointScan();
                        });
                    }),
                    createMenuItem(_("a11y_switch_switchToItemScan"), "objects", function() {
                        thisScope.hidePointMarker();

                        closeMenu();
                    }),
                    createMenuItem(_("a11y_switch_swipe"), "swipe", function() {
                        thisScope.hidePointMarker();

                        closeMenu();
                    }),
                    createMenuItem(_("a11y_switch_pinch"), "pinch", function() {
                        thisScope.hidePointMarker();

                        closeMenu();
                    }),
                    createMenuItem(_("a11y_switch_rotate"), "rotate", function() {
                        thisScope.hidePointMarker();

                        closeMenu();
                    }),
                    createMenuItem(_("a11y_switch_doubleClick"), "doubleclick", function() {
                        thisScope.hidePointMarker();

                        closeMenu();
                    }),
                    createMenuItem(_("a11y_switch_mouseButtons"), "mouse", function() {
                        thisScope.hidePointMarker();

                        closeMenu();
                    })
                ]);

                break;

            default:
                setMenuItems([]);

                break;
        }

        $g.sel(".a11y_switch_menu").show();

        $g.sel(".a11y_switch_menu button").first().focus();

        aui_a11y.setFocusTrap($g.sel(".a11y_switch_menu").get());
    }

    showPointMarker() {
        $g.sel(".a11y_switch_pointMarker").setStyle("left", `${this.pointScanTargetX}px`);
        $g.sel(".a11y_switch_pointMarker").setStyle("top", `${this.pointScanTargetY}px`);

        $g.sel(".a11y_switch_pointMarker").show();
    }

    hidePointMarker() {
        $g.sel(".a11y_switch_pointMarker").hide();
    }
}

a11y.registerAssistiveTechnology(SwitchNavigation);