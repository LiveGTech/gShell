/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export const SELECT_MOTION_TOLERANCE = 20;

export class ScrollableScreen {
    constructor(element) {
        this.element = element;

        this.initialTouchX = 0;
        this.lastTouchX = 0;
        this.initialScrollX = 0;
        this.lastScrollX = 0;
        this.targetScrollX = 0;
        this.targetInstantaneous = false;
        this.touchIsDown = false;
        this.scrolling = false;
        this.screenSelected = false;
        this.cancelScrollDecel = false;

        this.element.on("mousedown", (event) => this._touchStartEvent(event.pageX, event.pageY));
        this.element.on("touchstart", (event) => this._touchStartEvent(event.touches[0].pageX, event.touches[0].pageY));

        this.element.on("mousemove", (event) => this._touchMoveEvent(event.pageX, event.pageY));
        this.element.on("touchmove", (event) => this._touchMoveEvent(event.touches[0].pageX, event.touches[0].pageY));

        this.element.on("mouseup", (event) => this._touchEndEvent(event.target));
        this.element.on("touchend", (event) => this._touchEndEvent(event.target));

        setInterval(() => this._targetScroll(), 10);
    }

    get screenWidth() {
        return this.element.find(":scope > *").get().clientWidth;
    }

    get closestScreen() {
        var thisScope = this;

        return this.element.find(":scope > *").getAll().map(function(screenElement) {
            if (Math.abs(screenElement.offsetLeft - thisScope.element.get().scrollLeft) < thisScope.screenWidth / 2) {
                return $g.sel(screenElement);
            }
    
            return null;
        }).filter((element) => element != null)[0] || null;
    }

    selectScreen(screen) {
        // Don't implement toggling variable; default behaviour is non-selectable screens
    }

    deselectScreen() {
        this.screenSelected = false;
    }

    _touchStartEvent(touchX, touchY) {
        if (this.scrolling) {
            this.cancelScrollDecel = true;
        }
    
        this.initialTouchX = touchX;
        this.lastTouchX = touchX;
        this.initialScrollX = $g.sel(".switcher").get().scrollLeft;
        this.touchIsDown = true;
        this.scrolling = true;
    }

    _touchMoveEvent(touchX, touchY) {
        if (!this.touchIsDown) {
            return;
        }
    
        this.lastTouchX = touchX;
        this.lastScrollX = this.element.get().scrollLeft;
        this.element.get().scrollLeft = this.initialScrollX - (touchX - this.initialTouchX);
    }

    _touchEndEvent(target) {
        var thisScope = this;

        var rate = this.element.get().scrollLeft - this.lastScrollX;
        var multiplier = 1;
        var lastFrame = Date.now();

        this.touchIsDown = false;

        if (this.screenSelected) {
            this.screenSelected = false;

            return;
        }

        if (Math.abs(this.initialTouchX - this.lastTouchX) <= SELECT_MOTION_TOLERANCE) {
            this.scrolling = false;

            if (this.element.get().contains(target)) {
                setTimeout(function() {
                    thisScope.selectScreen($g.sel(target));                    
                });
            }

            return;
        }

        requestAnimationFrame(function continueScrolling() {
            if (thisScope.cancelScrollDecel) {
                thisScope.cancelScrollDecel = false;

                return;
            }

            thisScope.element.get().scrollLeft += rate * multiplier;
            multiplier *= 0.9 ** ((Date.now() - lastFrame) / 20);

            lastFrame = Date.now();

            if (multiplier > 0.1) {
                requestAnimationFrame(continueScrolling);

                return;
            }

            var closestScreen = thisScope.closestScreen;

            if (closestScreen != null) {
                thisScope.targetScrollX = closestScreen.get().offsetLeft;
            }

            thisScope.scrolling = false;
        });
    }

    _resizeEvent() {
        if (this.screenSelected) {
            return;
        }

        this.targetScrollX = this.closestScreen.offsetLeft;
        this.targetInstantaneous = true;
    }

    _targetScroll() {
        if (!this.scrolling) {
            var change = (this.targetScrollX - this.element.get().scrollLeft) * 0.2;

            if (this.targetInstantaneous || Math.abs(change) < 2) {
                this.element.get().scrollLeft = this.targetScrollX;
                this.targetInstantaneous = false;
            } else {
                this.element.get().scrollLeft += change;
            }
        }
    }
}