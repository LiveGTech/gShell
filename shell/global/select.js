/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

var selectionCallback = null;

export function setCallback(callback) {
    selectionCallback = callback;
}

export function resetCallback() {
    selectionCallback = function(value) {};
}

export function setCallbackFromElement(element) {
    setCallback(function(value) {
        element.setValue(value);
        element.emit("change");

        close();

        resetCallback();
    });
}

export function setCallbackFromWebview(webview) {
    setCallback(function(value) {
        webview.get().send("select_confirmOption", {value});

        close();

        resetCallback();
    });
}

export function getSelectItems(element) {
    return element.find("option, optgroup, hr").map(function(element) {
        if (element.is("option")) {
            return $g.create("button")
                .setText(element.getText())
                .on("click", function() {
                    selectionCallback(element.getAttribute("value"));
                })
            ;
        }

        if (element.is("optgroup")) {
            return $g.create("span").setText(element.getText());
        }

        if (element.is("hr")) {
            return $g.create("hr");
        }

        return null;
    }).filter((element) => element != null);
}

export function itemObjectsToElements(items) {
    return items.map(function(item) {
        if (item.type == "option") {
            return $g.create("button")
                .setText(item.text)
                .on("click", function() {
                    selectionCallback(item.value);
                })
            ;
        }

        if (item.type == "text") {
            return $g.create("span").setText(item.text);
        }

        if (item.type == "divider") {
            return $g.create("hr");
        }

        return null;
    }).filter((element) => element != null);
}

export function open(area = $g.sel(".select_fakeArea"), items = getSelectItems(area)) {
    $g.sel(".select_menu").clear().add(...items);

    $g.sel(".select_menu").menuOpen(area.get());

    $g.sel(".select_menu").setStyle("min-width", `${area.get().getBoundingClientRect().width}px`);
    $g.sel(".select_menu button").setStyle("max-width", "unset");
}

export function close() {
    $g.sel(".select_menu").menuClose();
}

export function setFakeArea(webview, bounds) {
    var webviewBounds = webview.get().getBoundingClientRect();

    bounds.top += webviewBounds.top;
    bounds.left += webviewBounds.left;

    $g.sel(".select_fakeArea").applyStyle({
        top: `${bounds.top}px`,
        left: `${bounds.left}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`
    });
}

export function init() {
    resetCallback();

    $g.sel("body").on("mousedown", function(event) {
        if (!event.target.matches("select")) {
            return;
        }

        setCallbackFromElement($g.sel(event.target));
        open($g.sel(event.target));

        event.preventDefault();
    });

    $g.sel("body").on("keydown", function(event) {
        if (![" ", "Enter"].includes(event.key)) {
            return;
        }

        if (!event.target.matches("select")) {
            return;
        }

        setCallbackFromElement($g.sel(event.target));
        open($g.sel(event.target));

        event.preventDefault();
    });
}