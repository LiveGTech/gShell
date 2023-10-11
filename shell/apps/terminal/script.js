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
    return $g.l10n.selectLocaleFromResources({
        "en_GB": "locales/en_GB.json",
        "fr_FR": "locales/fr_FR.json"
    }, "en_GB", {
        "fr_FR": "en_GB"
    });
}).then(function(locale) {
    window._ = function() {
        return locale.translate(...arguments);
    };

    window._format = function() {
        return locale.format(...arguments);
    };

    $g.sel("title").setText(_("terminal"));

    // TODO: Move desktop-environment-specific env vars to better location
    var sphereTerminal = new sphere.Terminal(null, [], {
        env: {
            TERM: "xterm-256color",
            IN_GOS_TERM: true,
            TERM_PROGRAM: "gshell-term",
            DESKTOP_SESSION: "gshell",
            XDG_SESSION_DESKTOP: "gshell",
            XDG_CURRENT_DESKTOP: "gShell"
        }
    });

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

    sphereTerminal.addEventListener("exit", function() {
        window.close();
    });

    xtermTerminal.onTitleChange(function(title) {
        $g.sel("title").setText(_("title", {title}));
    });

    xtermTerminal.onData(function(data) {
        sphereTerminal.write(data);
    });

    xtermTerminal.onResize(function(event) {
        sphereTerminal.setSize(event.cols, event.rows);
    });

    sphereTerminal.spawn();
});