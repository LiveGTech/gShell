/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

// Executable to set Caps Lock state

#include <stdio.h>
#include <stdbool.h>
#include <string.h>
#include <X11/Xlib.h>
#include <X11/XKBlib.h>

// @source reference https://unix.stackexchange.com/a/570304
// @licence ccbysa4 https://creativecommons.org/licenses/by-sa/4.0

int main(int argc, char* argv[]) {
    Display* display = XOpenDisplay(0);
    bool enabled = false;

    if (argc >= 2 && strcmp(argv[1], "true") == 0) {
        enabled = true;
    }

    if (!display) {
        fprintf(stderr, "Cannot open display to set Caps Lock state\n");

        return 1;
    }

    XkbLockModifiers(display, XkbUseCoreKbd, LockMask, enabled ? LockMask : 0);
    XSync(display, False);

    printf("New Caps Lock state: %s\n", enabled ? "enabled" : "disabled");

    return 0;
}