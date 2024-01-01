/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

// Library for gShell Linux app integration (libgslai)

#include <dlfcn.h>
#include <stdio.h>
#include <stdbool.h>
#include <X11/Xlib.h>

int (*shadowed_XNextEvent)(Display* display, XEvent* event_return);
int (*shadowed_XPeekEvent)(Display* display, XEvent* event_return);

bool checkXEvent(XEvent* event) {
    switch (event->type) {
        case ButtonPress:
        case ButtonRelease:
            event->xbutton.send_event = 0;

            return true;

        case MotionNotify:
            event->xmotion.send_event = 0;

            return true;

        case EnterNotify:
            event->xcrossing.send_event = 0;

            return true;

        case FocusOut:
            return false;

        default:
            return true;
    }
}

int XNextEvent(Display* display, XEvent* event_return) {
    if (!shadowed_XNextEvent) {
        shadowed_XNextEvent = dlsym(RTLD_NEXT, "XNextEvent");
    }

    while (true) {
        int returnValue = shadowed_XNextEvent(display, event_return);

        if (checkXEvent(event_return)) {
            return returnValue;
        }
    }
}

int XPeekEvent(Display* display, XEvent* event_return) {
    if (!shadowed_XPeekEvent) {
        shadowed_XPeekEvent = dlsym(RTLD_NEXT, "XPeekEvent");
    }

    int returnValue = shadowed_XPeekEvent(display, event_return);

    if (checkXEvent(event_return)) {
        // Peeked event is fine, so forward it
        return returnValue;
    }

    // Peeked event has been intercepted; find next event that is fine
    return XNextEvent(display, event_return);
}

int XGrabPointer(
    Display* display,
    Window grab_window,
    Bool owner_events,
    unsigned int event_mask,
    int pointer_mode,
    int keyboard_mode,
    Window confine_to,
    Cursor cursor,
    Time time
) {
    return GrabSuccess;
}

int XUngrabPointer(Display* display, Time time) {
    return 0;
}

int XGrabKeyboard(Display* display, Window grab_window, Bool owner_events, int pointer_mode, int keyboard_mode, Time time) {
    return GrabSuccess;
}

int XUngrabKeyboard(Display* display, Time time) {
    return 0;
}