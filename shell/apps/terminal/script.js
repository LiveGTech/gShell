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

window.devicePixelRatio = 1;

astronaut.unpack();

$g.waitForLoad().then(function() {
    var sphereTerminal = new sphere.Terminal("bash");

    var xtermTerminal = new xterm.Terminal({
        columns: 80,
        rows: 24,
        fontFamily: "Noto Sans Mono",
        theme: {
            background: "rgb(20, 20, 20)"
        }
    });

    var xtermFitAddonInstance = new xtermFitAddon.FitAddon();
    var xtermCanvasAddonInstance = new xtermCanvasAddon.CanvasAddon();

    var terminalContainer = Container({
        styles: {
            position: "fixed",
            width: "100%",
            height: "100%",
            backgroundColor: "rgb(20, 20, 20)"
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
        xtermFitAddonInstance.fit();
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