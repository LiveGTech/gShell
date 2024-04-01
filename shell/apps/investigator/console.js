/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";
import * as typeset from "gshell://lib/tsengine/src/typeset.js";

import * as protocol from "./protocol.js";

typeset.init();

const INPUT_LINE_STYLES = new astronaut.StyleGroup([
    new astronaut.StyleSet({
        "display": "flex"
    }),
    new astronaut.StyleSet({
        "width": "1rem",
        "height": "1rem",
        "margin-top": "0.2rem",
        "margin-left": "0.2rem",
        "margin-right": "0.2rem"
    }, "*", "img[aui-icon]"),
    new astronaut.StyleSet({
        "--typeset-background": "transparent",
        "height": "unset",
        "flex-grow": "1",
        "border-radius": "0"
    }, "*", "typeset-container"),
    new astronaut.StyleSet({
        "padding-inline-start": "0",
        "border-radius": "0",
        "white-space": "pre-wrap"
    }, "*", "textarea"),
    new astronaut.StyleSet({
        "white-space": "pre-wrap",
        "padding-inline-start": "0",
        "text-indent": "0"
    }, "*", "typeset-line"),
    new astronaut.StyleSet({
        "display": "none"
    }, "*", "typeset-line::before"),
    new astronaut.StyleSet({
        "content": "'.'",
        "visibility": "hidden"
    }, "*", "typeset-line:empty::after")
]);

const LOG_ENTRY_STYLES = new astronaut.StyleGroup([
    new astronaut.StyleSet({
        "display": "flex"
    }),
    new astronaut.StyleSet({
        "width": "1rem",
        "height": "1rem",
        "margin-top": "0.2rem",
        "margin-left": "0.2rem",
        "margin-right": "0.2rem"
    }, "*", "img[aui-icon]"),
    new astronaut.StyleSet({
        "flex-grow": "1",
        "font-family": "var(--fontCode)",
        "white-space": "pre-wrap",
        "line-break": "anywhere"
    }, "*", "> div"),
    new astronaut.StyleSet({
        "font-family": "var(--fontCode)"
    }, "*", "> div *"),
    new astronaut.StyleSet({
        "content": "'.'",
        "visibility": "hidden"
    }, "*", "> div:empty::after")
]);

export var ConsoleLogArray = astronaut.component("ConsoleLogArray", function(props, children) {
    if (props.length == 0) {
        return Text("[]");
    }

    if (props.summary) {
        return Text(`(${props.length}) [...]`);
    }

    return TextFragment (
        Text(`(${props.length}) [`),
        ...props.items.map(function(item, i) {
            return TextFragment (
                ConsoleLogValue(item) (),
                Text(i < props.items.length - 1 ? ", " : "")
            )
        }),
        Text("]")
    )
});

export var ConsoleLogObject = astronaut.component("ConsoleLogObject", function(props, children) {
    if (props.summary) {
        return Text(props.constructorName ? `${props.constructorName} {...}` : "{...}");
    }

    var keys = Object.keys(props.items);

    return TextFragment (
        Text(props.constructorName ? `${props.constructorName} {` : "{"),
        ...keys.map(function(key, i) {
            return TextFragment (
                Text(key),
                Text(": "),
                ConsoleLogValue(props.items[key]) (),
                Text(i < keys.length - 1 ? ", " : "")
            )
        }),
        Text("}")
    )
});

export var ConsoleLogValue = astronaut.component("ConsoleLogValue", function(props, children) {
    if (props.type == "array") {
        return ConsoleLogArray(props) (...children);
    }

    if (props.type == "object") {
        return ConsoleLogObject(props) (...children);
    }

    return Text(props.value);
});

export var ConsoleLogEntry = astronaut.component("ConsoleLogEntry", function(props, children) {
    var icon = Icon({
        icon: {
            "log": "back",
            "return": "back",
            "warning": "warning",
            "error": "error"
        }[props.level],
        type: "dark embedded"
    }) ();

    var entryContainer = Container({
        attributes: {
            "aui-select": "hint"
        }
    }) (
        Text(props.values.join(" "))
    );

    if (props.level == "log") {
        icon.setStyle("opacity", "0");
    }

    if (props.valueStorageId != null) {
        protocol.call("getConsoleValues", {valueStorageId: props.valueStorageId}).then(function(values) {
            entryContainer.clear().add(
                ...values.map((value) => TextFragment (ConsoleLogValue(value) (), Text(" ")))
            );
        });
    }

    return Container({
        styles: {
            backgroundColor: {
                "error": "hsla(0deg, 100%, 50%, 10%)",
                "warning": "hsla(40deg, 100%, 50%, 10%)"
            }[props.level] || "transparent"
        },
        styleSets: [LOG_ENTRY_STYLES]
    }) (
        icon,
        entryContainer
    );
});

export var Console = astronaut.component("Console", function(props, children) {
    var codeInputEditor = typeset.CodeEditor({
        language: "javascript"
    }) ();

    var codeInput = codeInputEditor.find("textarea");

    var logContainer = Container() ();

    var codeInputContainer = Container({
        styleSets: [INPUT_LINE_STYLES]
    }) (
        Icon({icon: "forward", type: "dark embedded"}) (),
        codeInputEditor
    );

    var consoleContainer = Container({
        styles: {
            display: "flex",
            flexDirection: "column",
            maxHeight: "100%",
            overflow: "auto"
        }
    }) (
        logContainer,
        codeInputContainer
    );

    var atBottom = true;

    function autoScroll() {
        if (atBottom) {
            consoleContainer.get().scrollTop = consoleContainer.get().scrollHeight;
        }
    }

    protocol.on("consoleLogAdded", function(event) {
        logContainer.add(ConsoleLogEntry(event) ());
        autoScroll();
    });

    protocol.call("getConsoleLogs").then(function(logs) {
        logs.forEach(function(log) {
            logContainer.add(ConsoleLogEntry(log) ());
            autoScroll();
        });
    });

    consoleContainer.on("scroll", function(event) {
        atBottom = event.target.scrollTop + event.target.clientHeight >= event.target.scrollHeight - 10;
        console.log(atBottom);
    });

    codeInput.on("keydown", function(event) {
        if (event.key == "Enter" && !event.shiftKey) {
            logContainer.add(
                Container({
                    styleSets: [INPUT_LINE_STYLES]
                }) (
                    Icon({icon: "forward", type: "dark embedded"}) (),
                    typeset.CodeEditor({
                        language: "javascript",
                        code: codeInputEditor.inter.getCode(),
                        readOnly: true
                    }) ()
                )
            );

            autoScroll();

            protocol.call("evaluate", {code: codeInputEditor.inter.getCode()});

            codeInputEditor.inter.setCode("");

            event.preventDefault();
        }
    });

    return consoleContainer;
});