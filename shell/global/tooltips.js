/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as pointer from "gshell://global/pointer.js";
import * as device from "gshell://system/device.js";

var lastTooltip = null;
var tooltipTimeout = null;

export function show(text) {
    hide();

    if (device.touchActive) {
        return;
    }

    if (text.trim() == "") {
        return;
    }

    tooltipTimeout = setTimeout(function() {
        var tooltip = $g.sel(".tooltip");

        tooltip
            .setText(text)
            .setStyle("left", "0")
        ;

        var xPosition = pointer.x + 16;
        var yPosition = pointer.y;
        var tooltipWidth = tooltip.get().clientWidth;
        var tooltipHeight = tooltip.get().clientHeight;

        if (xPosition + tooltipWidth >= window.innerWidth) {
            xPosition = pointer.x - tooltipWidth - 16;
        }

        if (yPosition + tooltipHeight >= window.innerHeight) {
            yPosition = window.innerHeight - tooltipHeight - 4;
        }

        tooltip
            .setStyle("top", `${yPosition}px`)
            .setStyle("left", `${xPosition}px`)
            .fadeIn(250)
        ;
    }, 1_000);
}

export function hide() {
    clearTimeout(tooltipTimeout);

    $g.sel(".tooltip").fadeOut(250);
}

export function init() {
    setInterval(function() {
        document.querySelectorAll("[title]").forEach(function(element) {
            element.setAttribute("sphere-:title", Element.prototype.getAttribute.apply(element, ["title"]));
            element.removeAttribute("title");
        });
    });

    window.addEventListener("mousemove", function(event) {
        if (!event.isTrusted) {
            return;
        }

        var closestTitleElement = event.target;
        var currentTooltip = null;

        while (true) {
            if (closestTitleElement.hasAttribute && closestTitleElement.hasAttribute("sphere-:title")) {
                currentTooltip = closestTitleElement.getAttribute("sphere-:title");

                break;
            }

            if (closestTitleElement == document) {
                break;
            }

            closestTitleElement = closestTitleElement.parentNode;
        }

        if (currentTooltip != lastTooltip) {
            lastTooltip = currentTooltip;

            if (currentTooltip != null) {
                show(currentTooltip);
            } else {
                hide();
            }
        }
    });
}