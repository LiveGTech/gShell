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

export var menus = {
    NONE: 0,
    MAIN: 1
};

export class SwitchNavigation extends a11y.AssistiveTechnology {
    constructor() {
        super();

        this.itemScanNextAt = -Infinity;
        this._currentMenu = menus.NONE;
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
                    thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanAfterConfirmPeriod;
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

            if (Date.now() - thisScope.itemScanNextAt < a11y.options.switch_itemScanPeriod) {
                return;
            }
    
            gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyDown", keyCode: "tab", modifiers: []}});
            gShell.call("io_input", {webContentsId: input.getWebContentsId(), event: {type: "keyUp", keyCode: "tab", modifiers: []}});

            thisScope.itemScanNextAt = Date.now() + a11y.options.switch_itemScanPeriod;

            // TODO: Add wait time after confirming selection to allow for repeated confirmations
        });
    }

    update() {
        $g.sel("body").setAttribute("liveg-a11y-switch", a11y.options.switch_enabled);
        $g.sel("body").setAttribute("liveg-a11y-scan", a11y.options.switch_enabled ? a11y.options.switch_scanColour : "");
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
                .on("click", function() {
                    thisScope.currentMenu = menus.NONE;

                    action();
                })
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

        switch (this._currentMenu) {
            case menus.MAIN:
                setMenuItems([
                    createMenuItem(_("a11y_switch_switchToPointScan"), "star", function() {
                        console.log("Hi!");
                    }),
                    createMenuItem(_("a11y_switch_switchToPointScan"), "star", function() {
                        console.log("Hi!");
                    }),
                    createMenuItem(_("a11y_switch_switchToPointScan"), "star", function() {
                        console.log("Hi!");
                    }),
                    createMenuItem(_("a11y_switch_switchToPointScan"), "star", function() {
                        console.log("Hi!");
                    }),
                    createMenuItem(_("a11y_switch_switchToPointScan"), "star", function() {
                        console.log("Hi!");
                    })
                ]);

                break;

            default:
                setMenuItems([]);

                break;
        }

        $g.sel(".a11y_switch_menu").show();

        $g.sel(".a11y_switch_menu button:first-of-type").focus();

        aui_a11y.setFocusTrap($g.sel(".a11y_switch_menu").get());
    }
}

a11y.registerAssistiveTechnology(SwitchNavigation);