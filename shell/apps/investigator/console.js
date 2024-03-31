/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as protocol from "./protocol.js";

export var Console = astronaut.component("Console", function(props, children) {
    var codeBlock = CodeBlock() ();
    var codeInput = Input() ();
    var codeLines = [];

    function updateCodeBlock() {
        codeBlock.setText(codeLines.join("\n"));
    }

    protocol.on("consoleLogAdded", function(event) {
        codeLines.push(`[${event.level}] ${event.values.join(" ")}`);

        updateCodeBlock();
    });

    protocol.call("getConsoleLogs").then(function(logs) {
        logs.forEach(function(log) {
            codeLines.push(`[${log.level}] ${log.values.join(" ")}`);

            updateCodeBlock();
        });
    });

    codeInput.on("keydown", function(event) {
        if (event.key == "Enter") {
            codeLines.push(`> ${codeInput.getValue()}`);

            updateCodeBlock();

            protocol.call("evaluate", {code: codeInput.getValue()});

            codeInput.setValue("");
        }
    });

    return Section (
        codeBlock,
        LineBreak() (),
        codeInput
    );
});