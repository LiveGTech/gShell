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

export var modes = {
    ITEM_SCAN: 0,
    POINT_SCAN: 1
};

export var menus = {
    NONE: 0,
    MAIN: 1,
    QUICK_SETTINGS: 2
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
            switch (event.key) {
                case " ":
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
                            // TODO: Implement finding coordinates and performing an action

                            thisScope.currentMode = modes.ITEM_SCAN;
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

        setInterval(function() {
            if (!a11y.options.switch_enabled) {
                return;
            }

            if (thisScope.currentMode == modes.ITEM_SCAN) {
                if (Date.now() - thisScope.itemScanNextAt < a11y.options.switch_itemScanPeriod) {
                    return;
                }
        
                gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyDown", keyCode: "tab", modifiers: []}});
                gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyUp", keyCode: "tab", modifiers: []}});

                thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanPeriod;
            }

            if (thisScope.currentMode == modes.POINT_SCAN) {
                if (Date.now() - thisScope.lastPointScanAdvance < 2) {
                    return;
                }

                if (thisScope.pointScanAxisIsY) {
                    thisScope.pointScanY += thisScope.pointScanAdvancingNegative ? -1 : 1;
                } else {
                    thisScope.pointScanX += thisScope.pointScanAdvancingNegative ? -1 : 1;
                }

                if (thisScope.pointScanX < 0 || thisScope.pointScanY < 0) {
                    thisScope.pointScanAdvancingNegative = false;
                }

                if (
                    thisScope.pointScanX > window.innerWidth - (thisScope.pointScanRefining ? (0.1 * window.innerHeight) : 0) ||
                    thisScope.pointScanY > window.innerHeight - (thisScope.pointScanRefining ? (0.1 * window.innerWidth) : 0)
                ) {
                    thisScope.pointScanAdvancingNegative = true;
                }

                var refinementPositionX = (thisScope.pointScanRefining && !thisScope.pointScanAxisIsY) ? thisScope.pointScanX : thisScope.pointScanRefinementX;
                var refinementPositionY = thisScope.pointScanRefining ? thisScope.pointScanY : thisScope.pointScanRefinementY;

                $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='x']").setStyle("left", `${refinementPositionX}px`);
                $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='y']").setStyle("top", `${refinementPositionY}px`);

                $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='x']").setStyle("left", `${refinementPositionX + ((thisScope.pointScanX / window.innerWidth) * 0.1 * window.innerHeight)}px`);
                $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='y']").setStyle("top", `${refinementPositionY + ((thisScope.pointScanY / window.innerHeight) * 0.1 * window.innerWidth)}px`);

                $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='x']").hide();
                $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='x']").hide();

                if (!thisScope.pointScanAxisIsY) {
                    $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='x']").show();

                    if (!thisScope.pointScanRefining) {
                        $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='x']").show();
                    }
                }

                $g.sel(".a11y_switch_pointScanRefiner[a11y-pointscanaxis='y']").hide();
                $g.sel(".a11y_switch_pointScanAxis[a11y-pointscanaxis='y']").hide();

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
        $g.sel("body").setAttribute("liveg-a11y-scancolour", a11y.options.switch_enabled ? a11y.options.switch_scanColour : "");
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

        switch (this._currentMenu) {
            case menus.MAIN:
                setMenuItems([
                    createMenuItem(_("a11y_switch_switchToPointScan"), "point", function() {
                        thisScope.currentMode = modes.POINT_SCAN;
                        thisScope.pointScanX = 0;
                        thisScope.pointScanY = 0;
                        thisScope.pointScanRefinementX = 0;
                        thisScope.pointScanRefinementY = 0;
                        thisScope.pointScanAxisIsY = false;
                        thisScope.pointScanAdvancingNegative = false;
                        thisScope.pointScanRefining = true;
                        thisScope.pointScanRefiningIsY = false;

                        closeMenu();
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

            default:
                setMenuItems([]);

                break;
        }

        $g.sel(".a11y_switch_menu").show();

        $g.sel(".a11y_switch_menu button").first().focus();

        aui_a11y.setFocusTrap($g.sel(".a11y_switch_menu").get());
    }
}

a11y.registerAssistiveTechnology(SwitchNavigation);