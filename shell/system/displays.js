/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as calc from "gshell://lib/adaptui/src/calc.js";

import * as monitors from "gshell://system/monitors.js";

export class Containment {
    constructor(top = false, bottom = false, left = false, right = false) {
        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }

    get full() {
        return this.top && this.bottom && this.left && this.right;
    }

    get none() {
        return !this.top && !this.bottom && !this.left && !this.right;
    }
}

export class Display {
    constructor(element) {
        this.element = element;

        this.rect = this.element.get().getBoundingClientRect();
    }

    containsCoordinates(x, y) {
        return (
            x >= this.rect.x &&
            y >= this.rect.y &&
            x < this.rect.x + this.rect.width &&
            y < this.rect.y + this.rect.height
        );
    }

    getContainment(rect, shouldIncludeAppBar = false) {
        var containment = new Containment();
        var displayWidth = this.rect.width;
        var displayHeight = this.rect.height + (shouldIncludeAppBar ? calc.getRemSize(2.8) : 0);

        if (rect.x >= this.rect.x && rect.x < this.rect.x + displayWidth) {
            containment.left = true;
        }

        if (rect.x + rect.width <= this.rect.x + displayWidth && rect.x + rect.width > this.rect.x) {
            containment.right = true;
        }

        if (rect.y >= this.rect.y && rect.y < this.rect.y + displayHeight) {
            containment.top = true;
        }

        if (rect.y + rect.height <= this.rect.y + displayHeight && rect.y + rect.height > this.rect.y) {
            containment.bottom = true;
        }

        return containment;
    }
}

export function getAllDisplays() {
    return $g.sel("aui-screen:not([hidden]) .display").map((element) => new Display(element));
}

export function fitElementInsideDisplay(element, shouldIncludeAppBar = true) {
    var rect = element.get().getBoundingClientRect();
    var displaysContainingElement = getAllDisplays().filter((display) => !display.getContainment(rect).none);
    var displayToFit = displaysContainingElement[0];

    if (!displayToFit) {
        displayToFit = getAllDisplays()[0];

        element.setStyle("top", `${displayToFit.rect.y}px`);
        element.setStyle("left", `${displayToFit.rect.x}px`);

        return false;
    }

    var containment = displayToFit.getContainment(rect, shouldIncludeAppBar);

    if (!containment.top) {
        element.setStyle("top", `${displayToFit.rect.y}px`);
    } else if (!containment.bottom) {
        element.setStyle("top", `${displayToFit.rect.y + displayToFit.rect.height - rect.height - (shouldIncludeAppBar ? calc.getRemSize(2.8) - 1 : 0)}px`);
    }

    if (!containment.left) {
        element.setStyle("left", `${displayToFit.rect.x}px`);
    } else if (!containment.right) {
        element.setStyle("left", `${displayToFit.rect.x + displayToFit.rect.width - rect.width}px`);
    }

    return true;
}

export function applyMonitorsToDisplays() {
    var primaryMonitor = monitors.getPrimaryConnectedMonitor();

    var extendedMonitors = monitors.getConnectedMonitors().filter(function(monitor) {
        if (monitor == primaryMonitor) {
            return false;
        }

        monitor.applyConfigDefaults();
        
        return monitor.config.view == "extend";
    });

    $g.sel(".display.primary").applyStyle({
        top: `${primaryMonitor.y}px`,
        left: `${primaryMonitor.x}px`,
        width: `${primaryMonitor.width}px`,
        height: `${primaryMonitor.height}px`
    });

    $g.sel(".displays").forEach(function(displayGroup) {
        var existingExtendedDisplays = displayGroup.find(".display.extended").items();

        extendedMonitors.forEach(function(monitor) {
            var display = existingExtendedDisplays.shift();
    
            if (!display) {
                var extendedTemplate = displayGroup.find(".display.extendedTemplate");

                if (!extendedTemplate.exists()) {
                    extendedTemplate = $g.create("div");
                }

                display = extendedTemplate
                    .copy()
                    .removeClass("extendedTemplate")
                    .addClass("extended")
                ;

                displayGroup.add(display);
            }

            display.applyStyle({
                top: `${monitor.y}px`,
                left: `${monitor.x}px`,
                width: `${monitor.width}px`,
                height: `${monitor.height}px`
            });
        });

        existingExtendedDisplays.forEach(function(display) {
            display.remove();
        });
    });
}