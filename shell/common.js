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
        "range": "slider",
        "search": "searchbox",
        "text": "textbox",
        "url": "urlinput"
    };

    var lastElement = null;
    var modifierKeyDown = false;

    function isEnabled() {
        if (window._sphere) {
            return _sphere._a11y_readout_enabled();
        }

        return a11y.options.readout_enabled;
    }

    function announce(data) {
        if (window._sphere) {
            _sphere._a11y_readout_announce(data);

            return;
        }

        a11y.callInAssistiveTechnology(a11y.modules.readout?.ReadoutNavigation, "announce", data);
    }

    function enterContext(element) {
        element.focus();

        announce({
            type: "message",
            message: "enterContext",
            hint: "toLeaveContext"
        });

        if (window._sphere) {
            return;
        }

        if (modifierKeyDown) {
            // Propagate modifier key state to child frame
            gShell.call("io_input", {webContentsId: element.getWebContentsId(), event: {type: "keydown", keyCode: "CapsLock"}});
        }
    }

    function isElementVisible(element) {
        if (getComputedStyle(element).display == "none") {
            return false;
        }

        if (element.offsetWidth == 0) {
            return false;
        }

        if (element.offsetHeight == 0) {
            return false;
        }

        if (element.getClientRects().length == 0) {
            return false;
        }

        if (element.matches("details:not([open]) *:not(details > summary, details > summary *)")) {
            return false;
        }

        return true;
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

        if (element.matches("input[type='checkbox'], input[type='radio']")) {
            return "";
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

    function moveToElement(element) {
        if (element == window) {
            lastElement = null;
        }

        if (lastElement == element) {
            return false;
        }

        if (element.nodeType != Node.ELEMENT_NODE) {
            return false;
        }

        if (element.matches("span") && element.parentNode?.closest(READABLE_ELEMENTS)) {
            return false;
        }

        var children = element.childNodes;
        var isTextual = false;

        for (var i = 0; i < children.length; i++) {
            isTextual ||= children[i].nodeType == Node.TEXT_NODE && children[i].textContent.trim() != "";
        }

        isTextual ||= element.matches(READABLE_ELEMENTS);

        if (!isTextual && !element.matches("webview")) {
            return false;
        }

        if (element.matches("[aria-hidden], [aria-hidden] *, [aria-label] *")) {
            return false;
        }

        if (!isElementVisible(element)) {
            return false;
        }
        
        var possiblyOpenModalElement = document.querySelector("dialog[open], aui-menu:not([hidden])");

        if (
            possiblyOpenModalElement &&
            isElementVisible(possiblyOpenModalElement) &&
            !element.matches("dialog[open] *, aui-menu:not([hidden]) *")
        ) {
            return false;
        }

        lastElement = element;

        document.querySelectorAll("[liveg-a11y-selected]").forEach((element) => element.removeAttribute("liveg-a11y-selected"));

        element.setAttribute("liveg-a11y-selected", true);

        var role = element.getAttribute("role");
        var state = null;

        if (element.matches("input:not([type])")) {
            role = "textbox";
        } else if (element.matches("input[type='checkbox'], input[type='radio']")) {
            state = element.indeterminate ? "indeterminate" : (element.checked ? "on" : "off");
        }

        Object.keys(INPUT_TYPES_TO_ARIA_ROLES).forEach(function(type) {
            if (!role && element.matches(`input[type="${type}" i]`)) {
                role = INPUT_TYPES_TO_ARIA_ROLES[type.toLowerCase()];
            }
        });

        if (!role) {
            role = TAG_NAMES_TO_ARIA_ROLES[element.tagName];
        }

        if (element.matches("webview")) {
            enterContext(element);
        } else {
            announce({
                type: "move",
                role: role || null,
                description: getElementDescription(element).trim(),
                label: getElementLabel(element)?.trim() || null,
                state
            });
        }
        
        return true;
    }

    ["focus", "focusin", "mousemove"].forEach(function(type) {
        window.addEventListener(type, function(event) {
            if (!isEnabled()) {
                return;
            }

            moveToElement(event.target);
        });
    });
    
    window.addEventListener("keyup", function(event) {
        if (event.code == "CapsLock") {
            modifierKeyDown = false;
        }
    });

    window.addEventListener("keydown", function(event) {
        if (!isEnabled()) {
            return;
        }

        if (event.code == "CapsLock") {
            modifierKeyDown = true;

            return;
        }

        if (!modifierKeyDown) {
            return;
        }

        event.preventDefault();

        if (event.key == " " && lastElement != null) {
            lastElement.focus();
            lastElement.click();
        }

        if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
            var allElements = [...document.querySelectorAll("*")];
            var lastIndex = allElements.findIndex((element) => element === lastElement);
            var currentIndex = lastIndex;

            do {
                if (event.key == "ArrowLeft") {
                    currentIndex--;
                } else {
                    currentIndex++;
                }

                if (currentIndex < 0) {
                    currentIndex = allElements.length - 1;
                }

                if (currentIndex >= allElements.length) {
                    currentIndex = 0;
                }

                if (currentIndex == lastIndex) {
                    return; // Looped through all elements, so we can't find any matches
                }
            } while (!moveToElement(allElements[currentIndex]));

            lastElement.scrollIntoViewIfNeeded();
        }
    });
});