/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

const LIFT_TO_UNLOCK_THRESHOLD = 80;

var currentUnlockLift = 0;
var initialTouchPosition = 0;
var touchIsDown = false;
var touchIsLocked = false;
var hideFront = false;

function renderUnlockLift() {
    $g.sel(".lockScreen_front").get().style.display = hideFront ? "none" : "block";

    $g.sel(".lockScreen_front").get().style.top = `${-currentUnlockLift}px`;
    $g.sel(".lockScreen_front").get().style.opacity = `${Math.max(1 - (Math.abs(currentUnlockLift) / 100), 0)}`;
}

function touchStartEvent(event) {
    if (touchIsLocked) {
        return;
    }

    if (!touchIsDown) {
        initialTouchPosition = event.pageY;
    }

    touchIsDown = true;
}

function touchMoveEvent(event) {
    if (touchIsLocked || !touchIsDown) {
        return;
    }

    currentUnlockLift = Math.max(initialTouchPosition - event.pageY, (initialTouchPosition - event.pageY) / 10);

    renderUnlockLift();
}

function touchEndEvent() {
    if (touchIsLocked) {
        return;
    }

    touchIsDown = false;

    if (currentUnlockLift > LIFT_TO_UNLOCK_THRESHOLD) {
        unlock();
    }
}

function unlockButtonEvent() {
    if (touchIsLocked) {
        return;
    }

    // TODO: Check if reduced motion is enabled, and if so, unlock instantly

    if (currentUnlockLift < 1) {
        currentUnlockLift = 1;
    }

    touchIsLocked = true;

    var unlockAnimation = setInterval(function() {
        currentUnlockLift = currentUnlockLift * 1.2;

        console.log(currentUnlockLift);

        renderUnlockLift();

        if (currentUnlockLift > 100) {
            clearInterval(unlockAnimation);

            unlock();

            currentUnlockLift = 0;
            touchIsLocked = false;
        }
    }, 10);
}

export function unlock() {
    hideFront = true;

    renderUnlockLift();

    $g.sel("#main").screenForward().then(function() {
        hideFront = false;

        renderUnlockLift();
    });
}

$g.waitForLoad().then(function() {
    $g.sel("#lockScreenMain").on("mousedown", touchStartEvent);
    $g.sel("#lockScreenMain").on("touchstart", touchStartEvent);

    $g.sel("#lockScreenMain").on("mousemove", touchMoveEvent);
    $g.sel("#lockScreenMain").on("touchmove", touchMoveEvent);

    $g.sel("#lockScreenMain").on("mouseup", touchEndEvent);
    $g.sel("#lockScreenMain").on("touchend", touchEndEvent);

    $g.sel("#lockScreen_unlockButton").on("click", unlockButtonEvent);

    $g.sel("body").on("keydown", function(event) {
        if (touchIsLocked || $g.sel("#lockScreenMain").get().hidden) {
            return;
        }

        if ([" ", "Enter"].includes(event.key)) {
            unlockButtonEvent();
        }
    });

    setInterval(function() {
        if (!touchIsLocked && !touchIsDown) {
            currentUnlockLift = currentUnlockLift / 1.2;

            renderUnlockLift();
        }
    }, 10);
});