/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

var draggingElement = null;
var panelStartX = 0;
var panelStartY = 0;
var pointerStartX = 0;
var pointerStartY = 0;

$g.waitForLoad().then(function() {
    $g.sel("body").on("pointermove", function(event) {
        if (draggingElement == null) {
            return;
        }

        var pointerDeltaX = event.clientX - pointerStartX;
        var pointerDeltaY = event.clientY - pointerStartY;

        draggingElement.applyStyle({
            left: `${panelStartX + pointerDeltaX}px`,
            right: "unset",
            top: `${panelStartY + pointerDeltaY}px`,
            bottom: "unset"
        });
    });

    $g.sel("body").on("pointerup", function() {
        if (draggingElement == null) {
            return;
        }

        draggingElement = null;

        $g.sel("#switcherView .switcher").removeClass("manipulating");
    });

    $g.sel(".a11y_panel_handle").on("pointerdown", function(event) {
        draggingElement = $g.sel(event.target).ancestor(".a11y_panel");

        var bounds = draggingElement.get().getBoundingClientRect();

        panelStartX = bounds.left;
        panelStartY = bounds.top;
        pointerStartX = event.clientX;
        pointerStartY = event.clientY;

        $g.sel("#switcherView .switcher").addClass("manipulating");
    });
});