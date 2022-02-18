/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

const SELECT_MOTION_TOLERANCE = 20;

var initialTouchX = 0;
var lastTouchX = 0;
var initialScrollX = 0;
var lastScrollX = 0;
var targetScrollX = 0;
var targetInstantaneous = false;
var touchIsDown = false;
var scrolling = false;
var screenSelected = false;
var cancelScrollDecel = false;

function getClosestScreen() {
    var switcherWidth = $g.sel(".switcher").get().clientWidth;
    var switcherScrollLeft = $g.sel(".switcher").get().scrollLeft;

    return $g.sel(".switcher .switcher_screen").getAll().map(function(screenElement) {
        if (Math.abs(screenElement.offsetLeft - switcherScrollLeft) < (switcherWidth * 0.7) / 2) {
            return $g.sel(screenElement);
        }

        return null;
    }).filter((element) => element != null)[0] || null;
}

function touchStartEvent(touchX, touchY) {
    if (scrolling) {
        cancelScrollDecel = true;
    }

    initialTouchX = touchX;
    lastTouchX = touchX;
    initialScrollX = $g.sel(".switcher").get().scrollLeft;
    touchIsDown = true;
    scrolling = true;
}

function touchMoveEvent(touchX, touchY) {
    if (!touchIsDown) {
        return;
    }

    var switcherElement = $g.sel(".switcher").get();

    lastTouchX = touchX;
    lastScrollX = switcherElement.scrollLeft;
    switcherElement.scrollLeft = initialScrollX - (touchX - initialTouchX);
}

function touchEndEvent(target) {
    var switcherElement = $g.sel(".switcher").get();

    function snapScrolling() {
        var closestScreen = getClosestScreen();

        if (closestScreen != null) {
            targetScrollX = closestScreen.get().offsetLeft;
        }

        scrolling = false;
    }

    var rate = switcherElement.scrollLeft - lastScrollX;
    var multiplier = 1;
    var lastFrame = Date.now();

    touchIsDown = false;

    if (screenSelected) {
        screenSelected = false;

        return;
    }

    if (Math.abs(initialTouchX - lastTouchX) <= SELECT_MOTION_TOLERANCE) {
        scrolling = false;

        if (
            target.matches(".switcher_screen") &&
            target.closest(".switcher").matches(".allowSelect")
        ) {
            selectScreen($g.sel(target));
        }

        return;
    }

    requestAnimationFrame(function continueScrolling() {
        if (cancelScrollDecel) {
            cancelScrollDecel = false;

            return;
        }

        switcherElement.scrollLeft += rate * multiplier;
        multiplier *= 0.9 ** ((Date.now() - lastFrame) / 20);

        lastFrame = Date.now();

        if (multiplier > 0.1) {
            requestAnimationFrame(continueScrolling);

            return;
        }

        snapScrolling();
    });
}

export function init() {
    $g.sel(".switcher_home").on("click", function() {
        goHome();
    });

    $g.sel(".switcher").on("mousedown", (event) => touchStartEvent(event.pageX, event.pageY));
    $g.sel(".switcher").on("touchstart", (event) => touchStartEvent(event.touches[0].pageX, event.touches[0].pageY));

    $g.sel(".switcher").on("mousemove", (event) => touchMoveEvent(event.pageX, event.pageY));
    $g.sel(".switcher").on("touchmove", (event) => touchMoveEvent(event.touches[0].pageX, event.touches[0].pageY));

    $g.sel(".switcher").on("mouseup", (event) => touchEndEvent(event.target));
    $g.sel(".switcher").on("touchend", (event) => touchEndEvent(event.target));

    window.addEventListener("resize", function() {
        if ($g.sel(".switcher_screen.selected").getAll().length == 0) {
            return;
        }

        targetScrollX = $g.sel(".switcher_screen.selected").get().offsetLeft;
        targetInstantaneous = true;
    });

    setInterval(function() {
        if (!scrolling) {
            var element = $g.sel(".switcher").get();
            var change = (targetScrollX - element.scrollLeft) * 0.2;

            if (targetInstantaneous || Math.abs(change) < 2) {
                element.scrollLeft = targetScrollX;
                targetInstantaneous = false;
            } else {
                element.scrollLeft += change;
            }
        }
    }, 10);
}

// TODO: Accept URL to open a specific app
export function openApp() {
    showList();

    var screenElement = $g.create("div").addClass("switcher_screen").add(
        $g.create("div").addClass("switcher_app").add(
            $g.create("main").add(
                $g.create("webview").setAttribute("src", "https://livegtech.github.io/Adapt-UI/demos/all/")
            )
        )
    );

    $g.sel("#switcherView .switcher").add(screenElement);

    return $g.sel("#switcherView").screenFade();
}

export function showList() {
    $g.sel(".switcher").addClass("allowSelect");
    $g.sel(".switcher_screen").removeClass("selected");
}

export function selectScreen(screenElement) {
    $g.sel(".switcher").removeClass("allowSelect");
    $g.sel(".switcher_screen").removeClass("selected");

    screenElement.addClass("selected");

    targetScrollX = screenElement.get().offsetLeft;

    return Promise.resolve();
}

export function closeAll() {
    $g.sel(".switcher_screen").remove();
}

export function goHome() {
    return $g.sel("#main").screenFade();
}