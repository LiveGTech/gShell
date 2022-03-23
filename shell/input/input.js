/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

export function show() {
    return Promise.all([
        $g.sel(".input").fadeIn(250),
        $g.sel(".input").easeStyleTransition("bottom", 0, 250)
    ]);
}

export function hide() {
    return Promise.all([
        $g.sel(".input").fadeOut(250),
        $g.sel(".input").easeStyleTransition("bottom", -20, 250)
    ]);
}