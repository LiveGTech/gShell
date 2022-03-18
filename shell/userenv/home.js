/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as screenScroll from "gshell://helpers/screenscroll.js";

var scroller = null;

export function init() {
    scroller = new screenScroll.ScrollableScreen($g.sel(".home"));

    $g.sel(".home_button").on("click", function() {
        $g.sel("#switcherView").screenFade();
    });
}