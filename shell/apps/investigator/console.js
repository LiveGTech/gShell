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

const EXPANDABLE_VALUE_STYLES = new astronaut.StyleGroup([
    new astronaut.StyleSet({
        "display": "inline",
        "margin": "0"
    }),
    new astronaut.StyleSet({
        "display": "inline",
        "padding": "0"
    }, "*", "summary"),
    new astronaut.StyleSet({
        "transform": "rotate(-90deg)"
    }, "*", "summary::before"),
    new astronaut.StyleSet({
        "transform": "rotate(0deg)"
    }, "[open]", "> summary::before")
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
        "line-break": "strict"
    }, "*", "> div"),
    new astronaut.StyleSet({
        "font-family": "var(--fontCode)"
    }, "*", "> div *"),
    new astronaut.StyleSet({
        "content": "'.'",
        "visibility": "hidden"
    }, "*", "> div:empty::after")
]);

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

export var ExpandableValue = astronaut.component("ExpandableValue", function(props, children) {
    var accordion = Accordion({
        ...props,
        styleSets: [EXPANDABLE_VALUE_STYLES]
    }) (
        children[0],
        Container({
            styles: {
                "margin-inline-start": "2rem"
            }
        }) (
            ...children.slice(1)
        )
    );

    var previouslyExpanded = false;

    accordion.on("toggle", function() {
        if (!previouslyExpanded) {
            accordion.emit("expand");
        }

        previouslyExpanded = true;

        accordion.ancestor(".console_logContainer").emit("autoscroll");
    });

    return accordion;
});

export var ConsoleLogString = astronaut.component("ConsoleLogString", function(props, children) {
    if (props.isLoggedValue) {
        return Text(props.value);
    }

    return TextFragment({
        styles: {
            color: "var(--typeset-highlight-string)"
        }
    }) (Text(`"${props.value}"`));
});

export var ConsoleLogNumber = astronaut.component("ConsoleLogNumber", function(props, children) {
    return TextFragment({
        styles: {
            color: "var(--typeset-highlight-number)"
        }
    }) (Text(props.value));
});

export var ConsoleLogAtom = astronaut.component("ConsoleLogAtom", function(props, children) {
    return TextFragment({
        styles: {
            color: "var(--typeset-highlight-valueKeyword)",
            fontWeight: "bold"
        }
    }) (Text(props.value));
});

export var ConsoleLogFunction = astronaut.component("ConsoleLogFunction", function(props, children) {
    return TextFragment({
        styles: {
            color: "var(--typeset-highlight-keyword)",
            fontWeight: "bold"
        }
    }) (Text("function"));
});

export var ConsoleLogElement = astronaut.component("ConsoleLogElement", function(props, children) {
    var summaryFragment = TextFragment (
        TextFragment({
            styles: {
                color: "var(--typeset-highlight-syntaxSymbol)"
            }
        }) (Text("<")),
        TextFragment({
            styles: {
                color: "var(--typeset-highlight-keyword)",
                fontWeight: "bold"
            }
        }) (Text(props.tagName)),
        ...Object.keys(props.attributes).map((key) => TextFragment (
            Text(" "),
            TextFragment({
                styles: {
                    color: "var(--typeset-highlight-identifier)"
                }
            }) (Text(key)),
            TextFragment({
                styles: {
                    color: "var(--typeset-highlight-syntaxSymbol)"
                }
            }) (Text("=")),
            TextFragment({
                styles: {
                    color: "var(--typeset-highlight-string)"
                }
            }) (Text(`"${props.attributes[key]}"`)))
        ),
        TextFragment({
            styles: {
                color: "var(--typeset-highlight-syntaxSymbol)"
            }
        }) (Text(">"))
    );

    if (props.summary) {
        return summaryFragment;
    }

    var childValues = props.children.map((child) => ConsoleLogValue(child) ());

    var expandedChildren = Container() (
        ...childValues.map((childValue) => Container (childValue))
    );

    var expandable = ExpandableValue (summaryFragment, expandedChildren);

    expandable.on("expand", function() {
        childValues.forEach(function(childValue) {
            childValue.inter.expand();
        });
    });

    return expandable;
});

export var ConsoleLogTextNode = astronaut.component("ConsoleLogTextNode", function(props, children) {
    return Text(`"${props.value}"`);
});

export var ConsoleLogArray = astronaut.component("ConsoleLogArray", function(props, children) {
    if (props.length == 0) {
        return Text("[]");
    }

    if (props.summary) {
        return Text(`(${props.length}) [...]`);
    }

    var childValues = props.items.map((item) => ConsoleLogValue(item) ());

    var expandedItems = Container() (
        ...childValues.map((childValue, i) => Container (
            Text(`${i}: `),
            childValue
        ))
    );

    var expandable = ExpandableValue (
        TextFragment (
            Text(`(${props.length}) [`),
            ...props.items.map((item, i) => TextFragment (
                ConsoleLogValue(item) (),
                Text(i < props.items.length - 1 ? ", " : "")
            )),
            Text("]")
        ),
        expandedItems
    );

    expandable.on("expand", function() {
        childValues.forEach(function(childValue) {
            childValue.inter.expand();
        });
    });

    return expandable;
});

export var ConsoleLogObject = astronaut.component("ConsoleLogObject", function(props, children) {
    if (props.summary) {
        return Text(props.constructorName ? `${props.constructorName} {...}` : "{...}");
    }

    var keys = Object.keys(props.items);

    var childValues = keys.map((key) => ConsoleLogValue(props.items[key]) ());

    var expandedItems = Container() (
        ...childValues.map((childValue, i) => Container (
            Text(keys[i]),
            Text(": "),
            childValue
        ))
    );

    var expandable = ExpandableValue (
        TextFragment(
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
        ),
        expandedItems
    );

    expandable.on("expand", function() {
        childValues.forEach(function(childValue) {
            childValue.inter.expand();
        });
    });

    return expandable;
});

export var ConsoleLogValue = astronaut.component("ConsoleLogValue", function(props, children, inter) {
    var valueContainer = TextFragment({
        styles: {
            verticalAlign: "top"
        }
    }) ();

    function populateContainer(data) {
        valueContainer.clear();

        valueContainer.choose(
            data.type,
            "string", (element) => element.add(ConsoleLogString(data) ()),
            "number", (element) => element.add(ConsoleLogNumber(data) ()),
            "atom", (element) => element.add(ConsoleLogAtom(data) ()),
            "function", (element) => element.add(ConsoleLogFunction(data) ()),
            "element", (element) => element.add(ConsoleLogElement(data) ()),
            "textNode", (element) => element.add(ConsoleLogTextNode(data) ()),
            "array", (element) => element.add(ConsoleLogArray(data) ()),
            "object", (element) => element.add(ConsoleLogObject(data) ()),
            (element) => element.add(Text(JSON.stringify(data.value)))
        );
    }

    inter.expand = function() {
        if (props.valueStorageId == null) {
            return;
        }

        protocol.call("expandConsoleValue", {
            valueStorageId: props.valueStorageId
        }).then(function(value) {
            populateContainer(value);

            valueContainer.ancestor(".console_logContainer").emit("autoscroll");
        });
    };

    populateContainer(props);

    return valueContainer;
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

    if (props.logStorageId != null) {
        protocol.call("getConsoleValues", {logStorageId: props.logStorageId}).then(function(values) {
            entryContainer.clear().add(
                ...values.map((value) => TextFragment (ConsoleLogValue({
                    ...value,
                    isLoggedValue: props.level != "return"
                }) (), Text(" ")))
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

    var logContainer = Container({
        classes: ["console_logContainer"]
    }) ();

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
    });

    logContainer.on("autoscroll", function() {
        autoScroll();
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