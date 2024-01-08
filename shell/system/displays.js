/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

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

    getContainment(rect) {
        var containment = new Containment();

        if (rect.x >= this.rect.x && rect.x < this.rect.x + this.rect.width) {
            containment.left = true;
        }

        if (rect.x + rect.width <= this.rect.x + this.rect.width && rect.x + rect.width > this.rect.x) {
            containment.right = true;
        }

        if (rect.y >= this.rect.y && rect.y < this.rect.y + this.rect.height) {
            containment.top = true;
        }

        if (rect.y + rect.height <= this.rect.y + this.rect.height && rect.y + rect.height > this.rect.y) {
            containment.bottom = true;
        }

        return containment;
    }
}

export function getAllDisplays() {
    return $g.sel("aui-screen:not([hidden]) .display").map((element) => new Display(element));
}

export function fitElementInsideDisplay(element) {
    var rect = element.get().getBoundingClientRect();
    var displaysContainingElement = getAllDisplays().filter((display) => !display.getContainment(rect).none);
    var displayToFit = displaysContainingElement[0];

    if (!displayToFit) {
        displayToFit = getAllDisplays()[0];

        element.setStyle("top", `${displayToFit.rect.y}px`);
        element.setStyle("left", `${displayToFit.rect.x}px`);

        return false;
    }

    var containment = displayToFit.getContainment(rect);

    if (!containment.top) {
        element.setStyle("top", `${displayToFit.rect.y}px`);
    } else if (!containment.bottom) {
        element.setStyle("top", `${displayToFit.rect.y + displayToFit.rect.height - rect.height}px`);
    }

    if (!containment.left) {
        element.setStyle("left", `${displayToFit.rect.x}px`);
    } else if (!containment.right) {
        element.setStyle("left", `${displayToFit.rect.x + displayToFit.rect.width - rect.width}px`);
    }

    return true;
}