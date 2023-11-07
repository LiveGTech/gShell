/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as dismiss from "gshell://lib/adaptui/src/dismiss.js";
import * as aui_a11y from "gshell://lib/adaptui/src/a11y.js";
import * as calc from "gshell://lib/adaptui/src/calc.js";
import * as screenScroll from "gshell://lib/adaptui/src/screenscroll.js";

import * as device from "gshell://system/device.js";
import * as a11y from "gshell://a11y/a11y.js";
import * as webviewManager from "gshell://userenv/webviewmanager.js";
import * as sphere from "gshell://sphere/sphere.js";

export const MAX_WAIT_UNTIL_LAUNCH = 2 * 1_000; // 2 seconds
export const WINDOW_RESIZE_BORDER_THICKNESS = calc.getRemSize(0.6);
export const DESKTOP_MIN_WINDOW_WIDTH = calc.getRemSize(20);
export const DESKTOP_MIN_WINDOW_HEIGHT = calc.getRemSize(15);
export const DESKTOP_DEFAULT_WINDOW_WIDTH = calc.getRemSize(40);
export const DESKTOP_DEFAULT_WINDOW_HEIGHT = calc.getRemSize(30);

export var main = null;

const WINDOW_STACK_WRAPAROUND = 10;

var topmostZIndex = 1;
var windowStackStep = 0;
var switcherBarGesturing = false;
var switcherBarSwitching = false;
var switcherBarTouchStartX = null;
var switcherBarTouchStartY = null;
var switcherBarScrollStartX = null;
var switcherBarTriggerDistance = 0;

export class WindowMoveResizeMode {
    constructor() {
        this.resizeNorth = false;
        this.resizeSouth = false;
        this.resizeEast = false;
        this.resizeWest = false;
    }

    get moveOnly() {
        return !(this.resizeNorth || this.resizeSouth || this.resizeEast || this.resizeWest);
    }

    get resizeHorizontal() {
        return this.resizeEast || this.resizeWest;
    }

    get resizeVertical() {
        return this.resizeNorth || this.resizeSouth;
    }
}

export class Switcher extends screenScroll.ScrollableScreen {
    constructor(element) {
        super(element);

        var thisScope = this;

        setInterval(function() {
            thisScope.element.find(".switcher_screen").getAll().forEach(function(screenElement) {
                if (screenElement.querySelector(".switcher_apps").contains(document.activeElement) && !$g.sel(screenElement).hasClass("selected")) {
                    $g.sel(screenElement).find(".switcher_screenButton").focus();
                }
            });
        });

        if (device.data?.type == "desktop") {
            this.element.on("pointerdown", function(event) {
                if (!thisScope.element.is(".allowSelect") && event.target == thisScope.element.get()) {
                    thisScope.selectDesktop();
                }
            });
        }
    }

    get screenWidth() {
        return this.element.find(":scope > *").get().clientWidth * 0.7; // 0.7 as the percentage used from the scale transform
    }

    selectScreen(screenElement) {
        var thisScope = this;

        if (screenElement.get().matches(".switcher_screen")) {
            $g.sel("#switcherView").removeClass("switcherOpen");

            this.element.removeClass("allowSelect");
            this.element.find(":scope > *").removeClass("selected");

            screenElement.removeClass("backgrounded");
            screenElement.addClass("selected");

            var listButton = $g.sel(`.desktop_appListButton[data-id="${screenElement.getAttribute("data-id")}"]`);

            $g.sel(".desktop_appListButton").removeClass("selected");
            listButton.addClass("selected");

            this.screenSelected = true;

            this.element.find(":scope > *").forEach((element) => setWindowGeometry(element, getWindowGeometry(element), true));

            this.element.find(":scope *:is(.switcher_titleBar, .switcher_apps)").setAttribute("inert", true);
            screenElement.find("*:is(.switcher_titleBar, .switcher_apps)").removeAttribute("inert");

            if (device.data?.type == "desktop") {
                screenElement.setStyle("z-index", topmostZIndex++);
            }

            showWindow(screenElement);

            setTimeout(function() {
                thisScope.targetInstantaneous = true;
                thisScope.targetScrollX = screenElement.get().offsetLeft;
            });

            setTimeout(function() {
                thisScope.element.find(":scope > *").addClass("backgrounded");
                screenElement.removeClass("backgrounded");
            }, aui_a11y.prefersReducedMotion() ? 0 : 500);
        }
    }

    deselectScreen() {
        this.screenSelected = false;
        this.scrolling = false;

        $g.sel("#switcherView").addClass("switcherOpen");

        this.element.addClass("allowSelect");
        this.element.find(":scope > *").removeClass("backgrounded");
        this.element.find(":scope > *").removeClass("selected");

        $g.sel(".desktop_appListButton").removeClass("selected");

        this.element.find(":scope *:is(.switcher_titleBar, .switcher_apps)").setAttribute("inert", true);

        this.element.find(":scope > *").setStyle("position", null);
        this.element.find(":scope > *").setStyle("top", null);
        this.element.find(":scope > *").setStyle("left", null);
        this.element.find(":scope > *").setStyle("width", null);
        this.element.find(":scope > *").setStyle("height", null);
    }

    selectDesktop() {
        if (device.data?.type != "desktop") {
            return;
        }

        $g.sel("#switcherView").removeClass("switcherOpen");

        this.element.removeClass("allowSelect");
        this.element.find(":scope > *").addClass("backgrounded");
        this.element.find(":scope > *").removeClass("selected");

        $g.sel(".desktop_appListButton").removeClass("selected");

        this.element.find(":scope > *").forEach((element) => setWindowGeometry(element, getWindowGeometry(element), true));
    }
}

export function init() {
    var pressedOnce = false;

    $g.sel(".switcher_home").on("click", function() {
        if (device.data?.type == "desktop") {
            $g.sel(".desktop_appMenu").menuOpen();

            return;
        }

        if (pressedOnce) {
            showList();

            pressedOnce = false;

            return;
        }

        setTimeout(function() {
            if (!pressedOnce) {
                return;
            }

            goHome();

            pressedOnce = false;
        }, a11y.options.touch_doublePressDelay);

        pressedOnce = true;
    });

    $g.sel(".switcher_showList").on("click", function() {
        showList();
    });

    $g.sel(".switcher_toggleList").on("click", function() {
        toggleList();
    });

    function switcherBarTouchStartEvent(touchX, touchY) {
        if (switcherBarGesturing) {
            return;
        }

        switcherBarGesturing = true;
        switcherBarSwitching = false;
        switcherBarTouchStartX = touchX;
        switcherBarTouchStartY = touchY;
        switcherBarScrollStartX = $g.sel(".switcher_screen.selected").get().offsetLeft;
        switcherBarTriggerDistance = 0;

        $g.sel(".switcher").addClass("gesturing");
    }

    function switcherBarTouchMoveEvent(touchX, touchY) {
        if (!switcherBarGesturing) {
            return;
        }

        var deltaX = touchX - switcherBarTouchStartX;
        var deltaY = touchY - switcherBarTouchStartY;

        main.targetInstantaneous = true;
        main.targetScrollX = main.element.get().scrollLeft = switcherBarScrollStartX - deltaX;

        switcherBarSwitching = Math.abs(deltaX) > 50;

        switcherBarTriggerDistance = Math.min(Math.abs(deltaY) / (window.innerHeight / 4), 1.5);

        var scale = 0.7 + (0.3 * (1 - switcherBarTriggerDistance));

        if (switcherBarSwitching) {
            $g.sel(".switcher").addClass("gestureSwitching");
            $g.sel(".switcher_screen.selected").setStyle("transform", "scale(0.7)");
        } else {
            $g.sel(".switcher").removeClass("gestureSwitching");
        }
        
        if (switcherBarTriggerDistance > 0.1 && !switcherBarSwitching) {
            $g.sel(".switcher_screen.selected").setStyle("transform", `scale(${scale})`);
        }
    }

    function switcherBarTouchEndEvent() {
        if (!switcherBarGesturing) {
            return;
        }

        switcherBarGesturing = false;

        selectScreen(main.closestScreen || $g.sel(".switcher_screen.selected"));

        $g.sel(".switcher").removeClass("gesturing");

        setTimeout(function() {
            $g.sel(".switcher").removeClass("gestureSwitching");            
        }, 500);

        $g.sel(".switcher_screen").setStyle("transform", null);

        if (switcherBarTriggerDistance > 0.75 && !switcherBarSwitching) {
            showList();
        }
    }

    $g.sel(".switcherBar").on("mousedown", (event) => switcherBarTouchStartEvent(event.pageX, event.pageY));
    $g.sel(".switcherBar").on("touchstart", (event) => switcherBarTouchStartEvent(event.touches[0].pageX, event.touches[0].pageY));

    $g.sel("body").on("mousemove", (event) => switcherBarTouchMoveEvent(event.pageX, event.pageY));
    $g.sel("body").on("touchmove", (event) => switcherBarTouchMoveEvent(event.touches[0].pageX, event.touches[0].pageY));

    $g.sel("body").on("mouseup", () => switcherBarTouchEndEvent());
    $g.sel("body").on("touchend", () => switcherBarTouchEndEvent());

    main = new Switcher($g.sel(".switcher"));

    if (device.data?.type == "desktop") {
        setInterval(function() {
            if ($g.sel("#switcherView .switcher .switcher_screen.maximised:not(.minimised)").getAll().length > 0) {
                $g.sel("#switcherView").addClass("hasMaximisedWindow");
            } else {   
                $g.sel("#switcherView").removeClass("hasMaximisedWindow");
            }
        });
    }
}

export function getWindowGeometry(element, forceRecalculation = false) {
    if (element.get().geometry && !forceRecalculation) {
        return element.get().geometry;
    }

    var rect = element.get().getBoundingClientRect();

    return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
    };
}

export function setWindowGeometry(element, geometry = getWindowGeometry(element), directResize = false) {
    if (device.data?.type != "desktop") {
        return;
    }

    var canResizeDirectly = directResize || !element.is(".switcher_indirectResize");

    if (geometry.width < DESKTOP_MIN_WINDOW_WIDTH) {
        geometry.width = DESKTOP_MIN_WINDOW_WIDTH;
    }

    if (geometry.height < DESKTOP_MIN_WINDOW_HEIGHT) {
        geometry.height = DESKTOP_MIN_WINDOW_HEIGHT;
    }

    if (canResizeDirectly) {
        element.get().geometry = geometry;
    } else {
        element.get().geometry ||= {width: geometry.width, height: geometry.height};
        element.get().geometry.x = geometry.x;
        element.get().geometry.y = geometry.y;
    }

    if ($g.sel("#switcherView .switcher").is(".allowSelect")) {
        return;
    }

    if (element.is(".maximised")) {
        element.setStyle("left", null);
        element.setStyle("top", null);
        element.setStyle("width", null);
        element.setStyle("height", null);
    } else {
        element.setStyle("left", `${geometry.x || 0}px`);
        element.setStyle("top", `${geometry.y || 0}px`);

        if (canResizeDirectly) {
            element.setStyle("width", `${geometry.width || 0}px`);
            element.setStyle("height", `${geometry.height || 0}px`);
        }
    }
}

export function sendResizeEvent(element, geometry = getWindowGeometry(element, true), otherDetail = {}) {
    element.emit("switcherresize", {geometry, ...otherDetail});
}

export function getWindowContentsGeometry(element) {
    return getWindowGeometry(element.find(".switcher_apps"), true);
}

export function getWindowContentsOffsets(element) {
    var windowGeometry = getWindowGeometry(element); // Use cached value for position values to prevent window from moving
    var recalculatedWindowGeometry = getWindowGeometry(element, true); // Use recaluclated value to get actual geometry when maximised
    var windowContentsGeometry = getWindowContentsGeometry(element);

    return {
        contentsX: windowContentsGeometry.x - windowGeometry.x,
        contentsY: windowContentsGeometry.y - windowGeometry.y,
        windowWidth: recalculatedWindowGeometry.width - windowContentsGeometry.width,
        windowHeight: recalculatedWindowGeometry.height - windowContentsGeometry.height
    };
}

export function setWindowContentsGeometry(element, geometry = getWindowContentsGeometry(element), directResize = false) {
    var offsets = getWindowContentsOffsets(element);

    setWindowGeometry(element, {
        x: geometry.x - offsets.contentsX,
        y: geometry.y - offsets.contentsY,
        width: geometry.width + offsets.windowWidth,
        height: geometry.height + offsets.windowHeight
    }, directResize);
}

export function openWindow(windowContents, appDetails = null, elementCallback = function() {}) {
    var initialGeometry = null;
    var pointerDown = false;
    var moveResizeMode = new WindowMoveResizeMode();
    var pointerStartX = 0;
    var pointerStartY = 0;
    var cursor = null;
    var shouldSelectScreen = false;
    var lastTitleBarPress = null;
    var shouldCancelUnsnap = false;

    var id = $g.core.generateKey();

    var screenElement = $g.create("div")
        .addClass("switcher_screen")
        .addClass("launching")
        .setAttribute("data-id", id)
        .on("pointermove", function(event) {
            if (device.data?.type != "desktop") {
                return;
            }

            var screenRect = screenElement.get().getBoundingClientRect();
            var pointerRelativeX = event.clientX - screenRect.left;
            var pointerRelativeY = event.clientY - screenRect.top;

            moveResizeMode = new WindowMoveResizeMode();

            moveResizeMode.resizeWest = pointerRelativeX <= WINDOW_RESIZE_BORDER_THICKNESS;
            moveResizeMode.resizeEast = pointerRelativeX > screenRect.width - WINDOW_RESIZE_BORDER_THICKNESS;
            moveResizeMode.resizeNorth = !screenElement.hasClass("maximised") && pointerRelativeY <= WINDOW_RESIZE_BORDER_THICKNESS;
            moveResizeMode.resizeSouth = pointerRelativeY > screenRect.height - WINDOW_RESIZE_BORDER_THICKNESS;

            cursor = null;

            if (!screenElement.hasClass("maximised")) {
                if ((moveResizeMode.resizeNorth && moveResizeMode.resizeWest) || (moveResizeMode.resizeSouth && moveResizeMode.resizeEast)) {
                    cursor = "nwse-resize";
                } else if ((moveResizeMode.resizeNorth && moveResizeMode.resizeEast) || (moveResizeMode.resizeSouth && moveResizeMode.resizeWest)) {
                    cursor = "nesw-resize";
                } else if (moveResizeMode.resizeHorizontal) {
                    cursor = "ew-resize";
                } else if (moveResizeMode.resizeVertical) {
                    cursor = "ns-resize";
                }
            }

            screenElement.setStyle("cursor", cursor);
        })
        .on("pointerdown", function(event) {
            if ($g.sel(event.target).is(".switcher_screen, .switcher_titleBar, .switcher_tabs, .switcher_titleBar.hideTabs .switcher_tabs *")) {
                $g.sel("#switcherView .switcher").addClass("manipulating");

                initialGeometry = {...getWindowGeometry(screenElement)};
                pointerDown = true;
                pointerStartX = event.clientX;
                pointerStartY = event.clientY;

                $g.sel("#switcherView .switcher").setStyle("cursor", cursor);
            }
        })
        .add(
            $g.create("div")
                .addClass("switcher_titleBar")
                .addClass("hideTabs")
                .on("pointerdown", function(event) {
                    if (!$g.sel(event.target).is(".switcher_titleBar:not(.hideTabs) .switcher_tabs *, .switcher_windowButtons *")) {
                        if (lastTitleBarPress != null && Date.now() - lastTitleBarPress <= a11y.options.touch_doublePressDelay) {
                            shouldCancelUnsnap = true;
    
                            if (!screenElement.hasClass("maximised")) {
                                maximiseWindow(screenElement);
                            } else {
                                restoreWindow(screenElement);
                            }
                        }
    
                        lastTitleBarPress = Date.now();
                    }
                })
                .add(
                    $g.create("div")
                        .addClass("switcher_tabs")
                        .setAttribute("inert", true)
                        .add(
                            $g.create("button")
                                .addClass("switcher_tabNewButton")
                                .setAttribute("title", _("switcher_newTab"))
                                .setAttribute("aria-label", _("switcher_newTab"))
                                .on("click", function() {
                                    var tab = screenElement.find(".switcher_tab.selected");
                                    var details = tab.get().app.get().details;

                                    if (!details?.newTabHandler) {
                                        openApp(tab.get().app.find("webview").get()?.getURL() || "about:blank", null, screenElement);

                                        return;
                                    }

                                    details.newTabHandler(screenElement);
                                })
                                .add(
                                    $g.create("img")
                                        .setAttribute("aui-icon", "dark embedded")
                                        .setAttribute("src", "gshell://lib/adaptui/icons/add.svg")
                                    ,
                                    $g.create("span")
                                        .addClass("switcher_tabNewButtonLabel")
                                        .setText(_("switcher_newTab"))
                                )
                        )
                    ,
                    $g.create("div")
                        .addClass("switcher_windowButtons")
                        .setAttribute("aria-role", "group")
                        .add(
                            $g.create("button")
                                .addClass("switcher_minimiseButton")
                                .setAttribute("title", _("switcher_minimise"))
                                .setAttribute("aria-label", _("switcher_minimise"))
                                .on("click", function() {
                                    minimiseWindow(screenElement);
                                })
                                .add(
                                    $g.create("img")
                                        .setAttribute("aui-icon", "dark embedded")
                                        .setAttribute("src", "gshell://lib/adaptui/icons/dropdown.svg")
                                )
                            ,
                            $g.create("button")
                                .addClass("switcher_maximiseButton")
                                .setAttribute("title", _("switcher_maximise"))
                                .setAttribute("aria-label", _("switcher_maximise"))
                                .on("click", function() {
                                    maximiseWindow(screenElement);
                                })
                                .add(
                                    $g.create("img")
                                        .setAttribute("aui-icon", "dark embedded")
                                        .setAttribute("src", "gshell://lib/adaptui/icons/fullscreen.svg")
                                )
                            ,
                            $g.create("button")
                                .addClass("switcher_restoreButton")
                                .setAttribute("title", _("switcher_restore"))
                                .setAttribute("aria-label", _("switcher_restore"))
                                .on("click", function() {
                                    restoreWindow(screenElement);
                                })
                                .add(
                                    $g.create("img")
                                        .setAttribute("aui-icon", "dark embedded")
                                        .setAttribute("src", "gshell://lib/adaptui/icons/fullscreen-exit.svg")
                                )
                            ,
                            $g.create("button")
                                .setAttribute("title", _("switcher_close"))
                                .setAttribute("aria-label", _("switcher_close"))
                                .on("click", function() {
                                    closeWindow(screenElement);
                                })
                                .add(
                                    $g.create("img")
                                        .setAttribute("aui-icon", "dark embedded")
                                        .setAttribute("src", "gshell://lib/adaptui/icons/close.svg")
                                )
                        )
                )
            ,
            $g.create("div").addClass("switcher_apps"),
            $g.create("button")
                .addClass("switcher_screenButton")
                .setAttribute("aria-label", "")
                .on("focus", function() {
                    if (!main.screenSelected) {
                        main.targetScrollX = screenElement.get().offsetLeft;
                    }
                })
                .on("click", function() {
                    shouldSelectScreen = true;
                })
                .on("keydown", function(event) {
                    if (event.key == " ") {
                        main.selectScreen(screenElement);

                        screenElement.find(".switcher_apps").focus();

                        shouldSelectScreen = false;
                    }
                })
            ,
            $g.create("button")
                .addClass("switcher_screenCloseButton")
                .setAttribute("aria-label", _("switcher_close"))
                .on("click", function() {
                    screenElement.addClass("closing");

                    screenElement.easeStyleTransition("opacity", 0).then(function() {
                        return screenElement.collapse(false);
                    }).then(function() {
                        closeWindow(screenElement, false);
                    });
                })
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "light")
                        .setAttribute("src", "gshell://lib/adaptui/icons/close.svg")
                        .setAttribute("alt", "")
                )
            ,
            $g.create("div")
                .addClass("switcher_screenOptions").add(
                    $g.create("button")
                        .on("click", function() {
                            $g.sel(".switcher_screen").fadeOut().then(function() {
                                closeAll();
                            });
                        })
                        .add(
                            $g.create("img")
                                .setAttribute("aui-icon", "light")
                                .setAttribute("src", "gshell://lib/adaptui/icons/close.svg")
                                .setAttribute("alt", "")
                            ,
                            $g.create("span").setText(_("switcher_closeAll"))
                        )
                )
        )
    ;

    screenElement.get().appListButton = $g.create("button")
        .addClass("desktop_appListButton")
        .addClass("transitioning")
        .setAttribute("data-id", id)
        .add(
            $g.create("img")
                .addClass("desktop_appListButton_icon")
                .setAttribute("aria-hidden", true)
                .on("error", function() {
                    screenElement.get().appListButton.find(".desktop_appListButton_icon").setAttribute("src", "gshell://media/appdefault.svg");
                })
        )
        .on("click", function() {
            if (screenElement.hasClass("selected") && !screenElement.hasClass("minimised")) {
                minimiseWindow(screenElement);

                return;
            }

            selectScreen(screenElement);
        })
    ;

    initialGeometry = {
        x: ((window.innerWidth - DESKTOP_DEFAULT_WINDOW_WIDTH) / (WINDOW_STACK_WRAPAROUND + 2)) * (windowStackStep + 1),
        y: ((window.innerHeight - DESKTOP_DEFAULT_WINDOW_HEIGHT) / (WINDOW_STACK_WRAPAROUND + 2)) * (windowStackStep + 1),
        width: DESKTOP_DEFAULT_WINDOW_WIDTH,
        height: DESKTOP_DEFAULT_WINDOW_HEIGHT
    };

    windowStackStep = (windowStackStep + 1) % WINDOW_STACK_WRAPAROUND;

    setWindowGeometry(screenElement, initialGeometry);

    $g.sel("body").on("pointermove", function(event) {
        if (!pointerDown) {
            return;
        }

        var pointerDeltaX = event.clientX - pointerStartX;
        var pointerDeltaY = event.clientY - pointerStartY;
        var newGeometry = {...getWindowGeometry(screenElement)};

        if (screenElement.hasClass("maximised") && pointerDeltaY > 0 && !shouldCancelUnsnap) {
            restoreWindow(screenElement, false);

            setWindowGeometry(screenElement, {
                ...getWindowGeometry(screenElement),
                x: event.clientX - (getWindowGeometry(screenElement).width / 2),
                y: event.clientY - (screenElement.find(".switcher_titleBar").get().getBoundingClientRect().height / 2)
            });
            
            initialGeometry = {...getWindowGeometry(screenElement)};
        }

        shouldCancelUnsnap = false;

        function handleHorizontal() {
            if (moveResizeMode.resizeWest) {
                newGeometry.width = initialGeometry.width - pointerDeltaX;
            }
    
            if (moveResizeMode.resizeEast) {
                newGeometry.width = initialGeometry.width + pointerDeltaX;
            }

            if (newGeometry.width < DESKTOP_MIN_WINDOW_WIDTH) {
                var distance = DESKTOP_MIN_WINDOW_WIDTH - newGeometry.width;

                newGeometry.width = DESKTOP_MIN_WINDOW_WIDTH;

                if (moveResizeMode.resizeWest) {
                    newGeometry.x = initialGeometry.x + pointerDeltaX - distance;
                }

                return;
            }

            if (moveResizeMode.moveOnly || moveResizeMode.resizeWest) {
                newGeometry.x = initialGeometry.x + pointerDeltaX;
            }
        }

        function handleVertical() {
            if (moveResizeMode.resizeNorth) {
                newGeometry.height = initialGeometry.height - pointerDeltaY;
            }

            if (moveResizeMode.resizeSouth) {
                newGeometry.height = initialGeometry.height + pointerDeltaY;
            }

            if (newGeometry.height < DESKTOP_MIN_WINDOW_HEIGHT) {
                var distance = DESKTOP_MIN_WINDOW_HEIGHT - newGeometry.height;

                newGeometry.height = DESKTOP_MIN_WINDOW_HEIGHT;

                if (moveResizeMode.resizeNorth) {
                    newGeometry.y = initialGeometry.y + pointerDeltaY - distance;
                }

                return;
            }

            if (moveResizeMode.moveOnly || moveResizeMode.resizeNorth) {
                newGeometry.y = initialGeometry.y + pointerDeltaY;
            }
        }

        handleVertical();
        handleHorizontal();

        setWindowGeometry(screenElement, newGeometry);

        if (newGeometry.width != initialGeometry.width || newGeometry.height != initialGeometry.height) {
            sendResizeEvent(screenElement, newGeometry);
        }
    });

    $g.sel("body").on("pointerup", function() {
        pointerDown = false;
        cursor = null;

        $g.sel("#switcherView .switcher").removeClass("manipulating");
        $g.sel("#switcherView .switcher").setStyle("cursor", null);
    });

    screenElement.find(".switcher_apps *").on("focus", function() {
        screenElement.find(".switcher_screenButton").focus();
    });

    screenElement.on("pointerdown", function(event) {
        if ($g.sel(event.target).is(".switcher_screenButton, .switcher_screenOptions, .switcher_screenOptions *")) {
            return;
        }

        main.selectScreen(screenElement);

        if (!$g.sel(event.target).is(".switcher_titleBar, .switcher_titleBar *")) {
            hideTabList(screenElement);
        }
    });

    screenElement.on("webviewevent", function(event) {
        if (event.detail.type == "pointerdown") {
            main.selectScreen(screenElement);

            if (!$g.sel(event.target).is(".switcher_titleBar, .switcher_titleBar *")) {
                hideTabList(screenElement);
            }
        }
    });

    if (appDetails?.showTabs) {
        convertToTabbedWindows(screenElement);
    }

    if (appDetails?.iconTransparency) {
        screenElement.find(".switcher_titleBar").addClass("transparentIcons");
    }

    var app = addAppToWindow(screenElement, windowContents, appDetails);

    function finishLaunch() {
        screenElement.removeClass("launching");
        screenElement.get().appListButton.removeClass("transitioning");
    }

    if (screenElement.find("webview").getAll().length > 0 && !appDetails?.instantLaunch) {
        screenElement.find("webview").on("dom-ready", function() {
            finishLaunch();
        });

        // If loading is taking too long, show the window anyway to prevent confusion
        setTimeout(function() {
            finishLaunch();
        }, MAX_WAIT_UNTIL_LAUNCH);
    } else {
        setTimeout(function() {
            finishLaunch();
        });
    }

    screenElement.on("dismissintent", function(event) {
        if (main.screenSelected) {
            event.preventDefault();
        }
    });

    screenElement.on("dismiss", function() {
        screenElement.addClass("closing");

        Promise.all([
            screenElement.collapse(false),
            screenElement.easeStyleTransition("opacity", 0)
        ]).then(function() {
            closeWindow(screenElement, false);
        });
    });

    screenElement.on("dismissreturnend", function() {
        if (shouldSelectScreen && !screenElement.is(".closing")) {
            main.selectScreen(screenElement);

            screenElement.find(".switcher_apps").focus();
        }

        shouldSelectScreen = false;
    });

    screenElement.swipeToDismiss(device.data?.type == "desktop" ? dismiss.directions.VERTICAL : dismiss.directions.UP);

    $g.sel("#switcherView .switcher").add(screenElement);
    $g.sel(".desktop_appList").add(screenElement.get().appListButton);

    main.selectScreen(screenElement);

    main.targetScrollX = screenElement.get().offsetLeft;
    main.scrolling = false;

    main._targetScroll();

    $g.sel(".desktop_appMenu").menuClose();

    elementCallback(screenElement, app);

    return $g.sel("#switcherView").screenFade();
}

export function addAppToWindow(element, windowContents, appDetails = null) {
    element.find(".switcher_app").addClass("hidden");
    element.find(".switcher_tab").removeClass("selected");

    var app = windowContents.addClass("switcher_app");

    element.find(".switcher_apps").add(app);

    var tab = $g.create("div")
        .addClass("switcher_tab")
        .addClass("selected")
        .addClass("transitioning")
        .on("auxclick", function() {
            closeApp(app);
        })
        .add(
            $g.create("button")
                .addClass("switcher_tabActivateButton")
                .add(
                    $g.create("img")
                        .addClass("switcher_tabIcon")
                        .setAttribute("aria-hidden", true)
                        .on("error", function() {
                            tab.find(".switcher_tabIcon").setAttribute("src", "gshell://media/appdefault.svg");
                        })
                    ,
                    $g.create("span")
                        .addClass("switcher_tabTitle")
                )
            ,
            $g.create("button")
                .addClass("switcher_tabCloseButton")
                .setAttribute("title", _("switcher_closeTab"))
                .setAttribute("aria-label", _("switcher_closeTab"))
                .on("click", function() {
                    if (app.ancestor(".switcher_screen").find(".switcher_app").getAll().length <= 1) {
                        goHome();
                    }

                    closeApp(app);
                })
                .add(
                    $g.create("img")
                        .setAttribute("aui-icon", "dark embedded")
                        .setAttribute("src", "gshell://lib/adaptui/icons/close.svg")
                )
        )
    ;

    app.get().details = appDetails;
    app.get().tab = tab;
    tab.get().app = app;

    app.get().usingCustomTab = false;
    app.get().lastTitle = null;
    app.get().lastIcon = null;

    if (appDetails != null) {
        app.get().lastTitle = appDetails.displayName;
        app.get().lastIcon = appDetails.icon;

        element.find(".switcher_screenButton").setAttribute("aria-label", appDetails.displayName);

        tab.find(".switcher_tabTitle").setText(appDetails.displayName);
        tab.find(".switcher_tabIcon").setAttribute("src", appDetails.icon);

        element.get().appListButton.setAttribute("title", _("switcher_appListTitle", {title: appDetails.displayName, count: getWindowAppCount(element) + 1}));
        element.get().appListButton.setAttribute("aria-label", appDetails.displayName);
        element.get().appListButton.find(".desktop_appListButton_icon").setAttribute("src", appDetails.icon);
    }

    element.find("webview").on("page-title-updated", function(event) {
        if (app.get().usingCustomTab) {
            return;
        }

        app.get().lastTitle = event.title;

        if (tab.hasClass("selected")) {
            element.find(".switcher_screenButton").setAttribute("aria-label", app.get().lastTitle);

            element.get().appListButton.setAttribute("title", _("switcher_appListTitle", {title: app.get().lastTitle, count: getWindowAppCount(element)}));
            element.get().appListButton.setAttribute("aria-label", app.get().lastTitle);
        }

        tab.find(".switcher_tabTitle").setText(app.get().lastTitle);
    });

    element.find("webview").on("page-favicon-updated", function(event) {
        if (app.get().usingCustomTab) {
            return;
        }

        app.get().lastIcon = appDetails?.icon || event.favicons[0];

        if (tab.hasClass("selected")) {
            element.get().appListButton.find(".desktop_appListButton_icon").setAttribute("src", app.get().lastIcon);
        }

        tab.find(".switcher_tabIcon").setAttribute("src", app.get().lastIcon);
    });

    tab.on("click", function() {
        selectApp(app);
    });

    element.find(".switcher_tabs").get().insertBefore(tab.get(), element.find(".switcher_tabNewButton").get());

    setTimeout(function() {
        tab.removeClass("transitioning");
    });

    return app;
}

export function minimiseWindow(element) {
    element.addClass("minimised");
    setWindowGeometry(element);

    $g.sel(".desktop_appListButton").removeClass("selected");
}

export function showWindow(element) {
    element.removeClass("minimised");
    setWindowGeometry(element);
}

export function maximiseWindow(element, animated = true) {
    if (animated) {
        element.addClass("transitioning");
    }

    element.addClass("maximised");

    setWindowGeometry(element, getWindowGeometry(element), true);
    sendResizeEvent(element, getWindowGeometry(element.ancestor(".switcher"), true), {maximising: true});

    if (animated) {
        setTimeout(function() {
            element.removeClass("transitioning");

            sendResizeEvent(element);
        }, aui_a11y.prefersReducedMotion() ? 0 : 500);
    }
}

export function restoreWindow(element, animated = true) {
    if (animated) {
        element.addClass("transitioning");
    }

    element.removeClass("maximised");

    setWindowGeometry(element, getWindowGeometry(element), true);

    if (animated) {
        setTimeout(function() {
            element.removeClass("transitioning");

            sendResizeEvent(element);
        }, aui_a11y.prefersReducedMotion() ? 0 : 500);
    }
}

export function closeWindow(element, animate = true) {
    return new Promise(function(resolve, reject) {
        var listButton = $g.sel(`.desktop_appListButton[data-id="${element.getAttribute("data-id")}"]`);
        var isLastScreen = $g.sel("#switcherView .switcher_screen").items().length == 1;

        element.addClass("closing");
        listButton.addClass("transitioning");

        function removeScreen() {
            element.find("webview").emit("switcherclose");

            element.remove();
        }

        (isLastScreen ? goHome() : Promise.resolve()).then(function() {
            setTimeout(function() {
                if (isLastScreen) {
                    main.selectDesktop();

                    goHome().then(function() {
                        removeScreen();
                    });
                } else {
                    removeScreen();
                }
    
                resolve();
            }, (aui_a11y.prefersReducedMotion() || !animate) ? 0 : 500);

            setTimeout(function() {
                listButton.remove();
            }, aui_a11y.prefersReducedMotion() ? 0 : 500);
        });
    });
}

export function getWindowStackingOrder() {
    return $g.sel("#switcherView .switcher")
        .find(".switcher_screen")
        .items()
        .sort((a, b) => Number(a.getStyle("z-index")) - Number(b.getStyle("z-index")))
    ;
}

export function openApp(url, appDetails = null, targetWindow = null) {
    if (url.split("?")[0] == "gsspecial://sphere") {
        sphere.openBrowser($g.core.parameter("startUrl", url));

        return;
    }

    return webviewManager.spawnAsUser(url, null, {privileged: url.startsWith("gshell://")}).then(function(webview) {
        var contents = $g.create("div").add(
            $g.create("main").add(webview)
        );

        function bindOpenWindowEvent(parentWindow = targetWindow) {
            webview.on("openframe", function(event) {
                var openingUrl = event.detail.url;
    
                if (new URL(openingUrl).origin == new URL(url).origin) {
                    convertToTabbedWindows(parentWindow);
                    openApp(openingUrl, appDetails, parentWindow);

                    return;
                }

                sphere.openBrowser(openingUrl, true);
            });
        }

        if (targetWindow != null) {
            addAppToWindow(targetWindow, contents, appDetails);

            bindOpenWindowEvent();

            return Promise.resolve();
        }

        return openWindow(contents, appDetails, function(parentWindow) {
            bindOpenWindowEvent(parentWindow);

            webview.on("close", function() {
                closeWindow(parentWindow);
            });
        });
    });
}

export function selectApp(element) {
    var screenElement = element.ancestor(".switcher_screen");

    screenElement.find(".switcher_app").addClass("hidden");
    screenElement.find(".switcher_tab").removeClass("selected");

    element.removeClass("hidden");
    element.get().tab.addClass("selected");

    if (element.get().lastTitle != null && element.get().lastIcon != null) {
        screenElement.find(".switcher_screenButton").setAttribute("aria-label", element.get().lastTitle);

        screenElement.get().appListButton.setAttribute("title", _("switcher_appListTitle", {title: element.get().lastTitle, count: getWindowAppCount(screenElement)}));
        screenElement.get().appListButton.setAttribute("aria-label", element.get().lastTitle);
        screenElement.get().appListButton.find(".desktop_appListButton_icon").setAttribute("src", element.get().lastIcon);
    }
}

export function closeApp(element) {
    var screenElement = element.ancestor(".switcher_screen");
    var allTabElements = screenElement.find(".switcher_tab:not(.transitioning)").getAll();

    if (allTabElements.length <= 1) {
        closeWindow(screenElement);

        return;
    }

    var tabIndex = allTabElements.findIndex((tabElement) => element.get().tab.get().isSameNode(tabElement));

    element.get().tab.addClass("transitioning");

    if (element.get().tab.hasClass("selected")) {
        if (tabIndex == 0) {
            selectApp(allTabElements[1].app);
        } else {
            selectApp(allTabElements[tabIndex - 1].app);
        }
    } else {
        selectApp(screenElement.find(".switcher_tab.selected").get().app);
    }

    element.remove();

    setTimeout(function() {
        element.get().tab.remove();
    }, aui_a11y.prefersReducedMotion() ? 0 : 500);
}

export function getWindowAppCount(element) {
    return element.find(".switcher_tab:not(.transitioning)").getAll().length;
}

export function setAppCustomTab(element, title, icon) {
    element.get().usingCustomTab = true;

    element.get().tab.find(".switcher_tabTitle").setText(title || "");

    if (icon) {
        element.get().tab.find(".switcher_tabIcon").setAttribute("src", icon);
    }
}

export function convertToTabbedWindows(element) {
    element.find(".switcher_titleBar").removeClass("hideTabs");

    element.find(".switcher_tabs")
        .removeAttribute("inert")
        .setAttribute("aria-role", "group")
    ;
}

export function showTabList(element) {
    if (element.hasClass("listTabs")) {
        return;
    }

    element.find(".switcher_titleBar").addClass("transitioning");
    element.addClass("listTabs");

    setTimeout(function() {
        element.find(".switcher_titleBar").removeClass("transitioning");
    });
}

export function hideTabList(element) {
    if (!element.hasClass("listTabs")) {
        return;
    }

    element.find(".switcher_titleBar").addClass("transitioning");

    setTimeout(function() {
        element.removeClass("listTabs");
    }, aui_a11y.prefersReducedMotion() ? 0 : 500);
}

export function showList() {
    main.deselectScreen();
}

export function selectScreen(screenElement) {
    main.selectScreen(screenElement);

    return Promise.resolve();
}

export function toggleList() {
    if ($g.sel("#switcherView .switcher").is(".allowSelect")) {
        main.selectDesktop();
    } else {
        main.deselectScreen();
    }
}

export function closeAll() {
    return goHome().then(function() {
        $g.sel("#switcherView .switcher_screen").remove();

        return Promise.resolve();
    });
}

export function goHome() {
    if (device.data?.type == "desktop") {
        return Promise.resolve();
    }

    return $g.sel("#home").screenFade();
}