/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

// Accessibility: Readout Navigation
(window._sphere ? Promise.resolve([]) : Promise.all([
    import("gshell://a11y/a11y.js")
])).then(function([
    a11y = null
]) {
    const READABLE_ELEMENTS = "img, button, input, progress, select, textarea, [aria-label]";

    var lastElement = null;

    function announce(data) {
        if (window._sphere) {
            _sphere._a11y_readout_announce(data);

            return;
        }

        a11y.callInAssistiveTechnology(a11y.modules.readout?.ReadoutNavigation, "announce", data);
    }

    function getElementDescription(element, type = elementDescriptionTypes.TEXTUAL) {
        var descriptionParts = [];

        if (element.nodeType == Node.TEXT_NODE) {
            return element.textContent;
        }

        if (element.nodeType != Node.ELEMENT_NODE) {
            return "";
        }

        if (element.hasAttribute("aria-label")) {
            return element.getAttribute("aria-label");
        }
        
        if (element.matches("img[alt]")) {
            return element.getAttribute("alt");
        }
        
        if (element.matches("input, progress, textarea")) {
            return element.value;
        }
        
        if (element.matches("select")) {
            return [...element.querySelectorAll("option")]
                .find((option) => option.value == element.value)
                .textContent
            ;
        }

        for (var i = 0; i < element.childNodes.length; i++) {
            descriptionParts.push(getElementDescription(element.childNodes[i]).trim());
        }

        descriptionParts = descriptionParts.filter((part) => part != "");

        return descriptionParts.join(" · ");
    }

    ["focus", "focusin", "mousemove"].forEach(function(type) {
        window.addEventListener(type, function(event) {
            if (lastElement == event.target) {
                return;
            }

            if (event.target.matches("span") && event.target.parentNode?.closest(READABLE_ELEMENTS)) {
                return;
            }

            var children = event.target.childNodes;
            var isTextual = false;

            for (var i = 0; i < children.length; i++) {
                isTextual ||= children[i].nodeType == Node.TEXT_NODE && children[i].textContent.trim() != "";
            }

            isTextual ||= event.target.matches(READABLE_ELEMENTS);

            if (!isTextual) {
                return;
            }

            if (event.target.matches("[aria-hidden], [aria-hidden] *, [aria-label] *")) {
                return;
            }

            lastElement = event.target;

            announce({
                type: "move",
                elementType: event.target.tagName,
                description: getElementDescription(event.target).trim()
            });
        });
    });
});