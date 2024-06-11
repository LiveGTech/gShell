# Linux app integration
In addition to being a desktop environment for web apps, gShell can also run command-line and graphical Linux apps.

## Command-line programs
The Terminal app provides a pseudoterminal (PTY) that can be used to run command-line programs. The Terminal app launches the default shell for the current user (this is typically `bash` on LiveG OS).

## Graphical apps
gShell can run as a compositing window manager for apps that support the Xorg windowing system. gShell makes use of the XComposite extension for Xorg to render windows in `canvas` elements. Input events from those `canvas` elements are then sent back to the relevant windows by being converted from JavaScript events to Xorg events.

The library for gShell Linux app integration (`libgslai`, whose source is at `src/csrc/libgslai.c`) is responsible for overriding the functionality of Xlib to ensure that input events are received correctly by windows. This includes ensuring that the `send_event` property of events is always set to `0` to prevent windows from assuming that gShell events are untrusted.

The Adapt UI Linux theme is available to give GTK apps a visual appearance similar to that seen in web apps that use Adapt UI. The source for this theme is in the [LiveGTech/Adapt-UI-Linux](https://github.com/LiveGTech/Adapt-UI-Linux) GitHub repository.

## Controlling gShell from Linux apps
gShell creates a temporary filesystem at `/system/control` (`~/gShell/control` in the simulator) that contains a number files that may be read and written to by Linux apps to control gShell — similarly to how `/sys` can be used to control various aspects of a Linux system.

Here is a list of files contained in this filesystem (defined in `src/control.js`):

* `actions/openInSphere`: Writing a URL to this file will open that URL in Sphere.
* `actions/addApp`: Writing the process name of a Linux app will add that app to the app menu/home screen.

### The `gosctl` utility
LiveG OS includes the `gosctl` utility (the name being shortened from _LiveG OS control_) as an alternative way to control gShell and LiveG OS. It uses the same filesystem at `/system/control`, but using an alternative, command-orientated interface.

Scripts may use the `gosctl` utility but implementors may find it easier to directly write to the files in `/system/control`.

For help with using the `gosctl` utility, run `gosctl --help`.

`sphere` is an alias for `gosctl open-in-sphere`. To open https://liveg.tech in Sphere, run `sphere https://liveg.tech`.