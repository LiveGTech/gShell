# Linux app integration
In addition to being a desktop environment for web apps, gShell can also run command-line and graphical Linux apps.

## Command-line programs
The Terminal app provides a pseudoterminal (PTY) that can be used to run command-line programs. The Terminal app launches the default shell for the current user (this is typically `bash` on LiveG OS).

## Graphical apps
gShell can run as a compositing window manager for apps that support the Xorg windowing system. gShell makes use of the XComposite extension for Xorg to render windows in `canvas` elements. Input events from those `canvas` elements are then sent back to the relevant windows by being converted from JavaScript events to Xorg events.

The library for gShell Linux app integration (`libgslai`, whose source is at `src/csrc/libgslai.c`) is responsible for overriding the functionality of Xlib to ensure that input events are received correctly by windows. This includes ensuring that the `send_event` property of events is always set to `0` to prevent windows from assuming that gShell events are untrusted.