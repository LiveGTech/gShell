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
    const TARGET_ELEMENTS = "address, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, figcaption, hr, li, p, pre, a, span, img, video, svg, math, caption, tr, button, input, progress, select, textarea, summary, marquee";

    var lastElement = null;

    function announce(data) {
        if (window._sphere) {
            _sphere._a11y_readout_announce(data);

            return;
        }

        a11y.callInAssistiveTechnology(a11y.modules.readout?.ReadoutNavigation, "announce", data);
    }

    ["focusin", "mousemove"].forEach(function(type) {
        window.addEventListener(type, function(event) {
            if (lastElement == event.target) {
                return;
            }

            if (type != "focusin" && !event.target.matches(TARGET_ELEMENTS)) {
                return;
            }

            if (event.target.matches("span") && event.target.parentNode?.closest(TARGET_ELEMENTS)) {
                return;
            }

            if (event.target.matches("[aria-hidden], [aria-hidden] *, [aria-label] *")) {
                return;
            }

            lastElement = event.target;

            announce({
                type: "move",
                elementType: event.target.tagName,
                description: event.target.getAttribute("aria-label") || event.target.getAttribute("alt") || event.target.textContent
            });
        });
    });
});