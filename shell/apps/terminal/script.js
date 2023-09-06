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
import xtermCanvasAddon from "gshell://lib/xterm-addon-canvas.esm.js";

astronaut.unpack();

$g.waitForLoad().then(function() {
    var sphereTerminal = new sphere.Terminal("bash");

    var xtermTerminal = new xterm.Terminal({
        fontFamily: "Noto Sans Mono"
    });

    var xtermFitAddonInstance = new xtermFitAddon.FitAddon();
    var xtermCanvasAddonInstance = new xtermCanvasAddon.CanvasAddon();

    var terminalContainer = Container({
        styles: {
            height: "100%",
            backgroundColor: "black"
        }
    }) ();

    var resizeObserver = new ResizeObserver(function(entries) {
        xtermFitAddonInstance.fit();
    });

    resizeObserver.observe(terminalContainer.get());

    astronaut.render(terminalContainer);

    xtermTerminal.loadAddon(xtermFitAddonInstance);
    xtermTerminal.loadAddon(xtermCanvasAddonInstance);

    xtermTerminal.open(terminalContainer.get());

    sphereTerminal.addEventListener("data", function(event) {
        console.log("read", Date.now());
        xtermTerminal.write(event.data);
    })

    xtermTerminal.onData(function(data) {
        sphereTerminal.write(data);
    });

    xtermTerminal.onResize(function(event) {
        sphereTerminal.setSize(event.cols, event.rows);
    });

    sphereTerminal.spawn();
});