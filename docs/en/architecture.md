# Architecture
gShell uses web technologies to make development easier! It runs on top of the Linux kernel. Here is a basic architecture overview (information on each section is below):

- Linux Kernel
  - X11 Xsession
    - gShell (Electron runtime)
      - OOBS (Out-of-box setup)
        - Basic power menu
      - Lock screen
        - Notifications
        - Incoming call screen
        - Basic power menu
      - User environment
        - User-specific power menu
        - Home screen
        - Notifications
        - Incoming call screen
        - App switcher
          - Running privileged system apps
            - (example) Settings
            - (example) Sphere browser
          - Running unprivileged apps
            - (example) Calculator
            - (example) Phone

## Explanations
**Linux Kernel** - The underlying system (Mobian in the case of the LiveG Prism build)

**X11 Xsession** - Creates a graphical session to run gShell in

**gShell (Electron runtime)** - The gShell runtime that uses Electron and Node.js. All child layers are represented in HTML.

**OOBS (Out-of-box setup)** - When the gShell user uses their phone for the first time, this is shown, and it lets the user set up their phone, including options such as setting the passcode, the user's personal details (like their name), the phone's name, WiFi connection details etc.

**Basic power menu** - A simple power menu that provides options to shutdown or restart the phone.

**Lock screen** - A screen showing the current time above the user's wallpaper and notifications, amongst other things. It also checks the password before unlocking the phone and switching to the user environment.

**Notifications** - The notifications drawer that contains various settings (some of which are only accessible inside the user environment).

**User environment** - The environment used by the user once they have unlocked their phone, and lets the user open apps and perform other functions.

**User-specific power menu** - a power menu that extends the basic power menu to include shortcuts to time-critical apps (e.g. to show the user's bus pass or pay for an item)

**Home screen** - Lets the user launch apps. Its appearance can be customised (such as wallpaper, icons, and icon placement)

**Incoming call screen** - When somebody is calling, this screen pops up to let the user answer the call, and then it handles the UI throughout the duration of the call.

**App switcher** - Lets the user switch between running apps, and contains the running apps as child elements inside ```webview``` tags.

**Running privileged system apps** - Running apps that are not inside ```webview``` tags and have full access to the system, such as to manage system settings or display child web pages without restrictions (because ```webview``` tags cannot embed ```webview``` tags but they can embed ```iframe``` tags, but ```iframe``` tags are more restrictive in terms of the pages they can show)

**Running unprivileged apps** - Running apps that are inside ```webview``` tags and have an API that must request permissions from the user. These apps are typically third-party apps.
