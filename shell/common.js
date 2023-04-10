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

    const TAG_NAMES_TO_ARIA_ROLES = {
        "ARTICLE": "article",
        "BUTTON": "button",
        "TD": "cell",
        "TH": "columnheader",
        "DIALOG": "dialog",
        "BODY": "document",
        "SUMMARY": "expandable",
        "FIGURE": "figure",
        "FORM": "form",
        "H1": "heading",
        "H2": "heading",
        "H3": "heading",
        "H4": "heading",
        "H5": "heading",
        "H6": "heading",
        "IMG": "img",
        "INPUT": "input",
        "A": "link",
        "UL": "list",
        "OL": "list",
        "SELECT": "listbox",
        "LI": "listitem",
        "MAIN": "main",
        "MARK": "mark",
        "MARQUEE": "marquee",
        "MATH": "math",
        "NAV": "navigation",
        "PROGRESS": "progressbar",
        "TR": "row",
        "SECTION": "section",
        "TABLE": "table",
        "TEXTAREA": "textarea"
    };

    const INPUT_TYPES_TO_ARIA_ROLES = {
        "checkbox": "checkbox",
        "radio": "radio",
        "range": "range",
        "search": "searchbox",
        "text": "textbox"
    };

    var lastElement = null;

    function announce(data) {
        if (window._sphere) {
            _sphere._a11y_readout_announce(data);

            return;
        }

        a11y.callInAssistiveTechnology(a11y.modules.readout?.ReadoutNavigation, "announce", data);
    }

    function getElementDescription(element) {
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

        // TODO: Support `[aria-labelledby]` and `[aria-describedby]`

        for (var i = 0; i < element.childNodes.length; i++) {
            descriptionParts.push(getElementDescription(element.childNodes[i]).trim());
        }

        descriptionParts = descriptionParts.filter((part) => part != "");

        return descriptionParts.join(" · ");
    }

    function getElementLabel(element) {
        if (element.nodeType != Node.ELEMENT_NODE) {
            return null;
        }

        var id = element.getAttribute("id");
        var labelElement = null;

        if (id != null) {
            [...document.querySelectorAll("label[for]")].forEach(function(element) {
                if (element.getAttribute("for") == id) {
                    labelElement = element;
                }
            });
        }

        if (labelElement != null) {
            return getElementDescription(labelElement);
        }

        if (element.hasAttribute("placeholder")) {
            return element.getAttribute("placeholder");
        }

        return null;
    }

    ["focus", "focusin", "mousemove"].forEach(function(type) {
        window.addEventListener(type, function(event) {
            if (lastElement == event.target) {
                return;
            }

            if (event.target.nodeType != Node.ELEMENT_NODE) {
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

            var role = event.target.getAttribute("role");

            Object.keys(INPUT_TYPES_TO_ARIA_ROLES).forEach(function(type) {
                if (!role && event.target.matches(`input[type="${type}" i]`)) {
                    role = INPUT_TYPES_TO_ARIA_ROLES[type.toLowerCase()];
                }
            });

            if (!role) {
                role = TAG_NAMES_TO_ARIA_ROLES[event.target.tagName];
            }

            announce({
                type: "move",
                role: role || null,
                description: getElementDescription(event.target).trim(),
                label: getElementLabel(event.target)?.trim() || null
            });
        });
    });
});