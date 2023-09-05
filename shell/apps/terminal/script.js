/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";
import xterm from "gshell://lib/xterm.esm.js";
import xtermFitAddon from "gshell://lib/xterm-addon-fit.esm.js";

const FONT_STYLES = new astronaut.StyleSet({
    "font-family": "var(--fontCode)"
}, undefined, "*");

astronaut.unpack();

$g.waitForLoad().then(function() {
    var sphereTerminal = new sphere.Terminal("bash");

    var xtermTerminal = new xterm.Terminal({
        fontFamily: "var(--font-code)"
    });

    var xtermFitAddonInstance = new xtermFitAddon.FitAddon();

    var terminalContainer = Container({
        styles: {
            height: "100%",
            backgroundColor: "black"
        },
        styleSets: [FONT_STYLES]
    }) ();

    astronaut.render(terminalContainer);

    xtermTerminal.loadAddon(xtermFitAddonInstance);
    xtermTerminal.open(terminalContainer.get());

    sphereTerminal.addEventListener("data", function(event) {
        xtermTerminal.write(event.data);
    })

    xtermTerminal.onData(function(data) {
        sphereTerminal.write(data);
    });

    setInterval(function() {
        xtermFitAddonInstance.fit();        
    });

    sphereTerminal.spawn();
});