/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

// Library for gShell Linux app integration (libgslai)

#define _GNU_SOURCE

#include <dlfcn.h>
#include <stdio.h>
#include <stdbool.h>
#include <X11/Xlib.h>

int (*shadowed_XNextEvent)(Display* display, XEvent* event_return);
int (*shadowed_XPeekEvent)(Display* display, XEvent* event_return);

bool checkXEvent(Display* display, XEvent* event) {
    switch (event->type) {
        case KeyPress:
        case KeyRelease:
            if (event->xkey.keycode == 124) {
                // Forward power button events to gShell as they are not exposed with `XQueryKeymap`

                XSendEvent(
                    display,
                    event->xkey.root,
                    0,
                    event->type == KeyPress ? KeyPressMask : KeyReleaseMask,
                    event
                );

                return false;
            }

            event->xkey.send_event = 0;

            return true;

        case ButtonPress:
        case ButtonRelease:
            event->xbutton.send_event = 0;

            return true;

        case MotionNotify:
            event->xmotion.send_event = 0;

            return true;

        case EnterNotify:
        case LeaveNotify:
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

        if (checkXEvent(display, event_return)) {
            return returnValue;
        }
    }
}

int XPeekEvent(Display* display, XEvent* event_return) {
    if (!shadowed_XPeekEvent) {
        shadowed_XPeekEvent = dlsym(RTLD_NEXT, "XPeekEvent");
    }

    int returnValue = shadowed_XPeekEvent(display, event_return);

    if (checkXEvent(display, event_return)) {
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