# Input Method Editor
The Input Method Editor (IME) is an integrated tool for gShell which provides a virtual, on-screen keyboard, text autocorrection, predictive text input, and CJK character input from romanised text entry.

## Virtual keyboard layouts
Built-in virtual keyboard layouts are stored in `shell/input/layouts` and those layout files are named with the scheme `<localeCode>_<variant>.gkbl`, where `<localeCode>` is the locale code (from files named in `shell/locales`) and `<variant>` is the keyboard layout variant, such as `qwerty` for QWERTY.

Layout files are written in the JSON text format. Comprehensive examples of layout files can be found in `shell/input/layouts`. The main values are:

* `localeCode`: the locale code associated with the keyboard layout (for example, `en_GB`)
* `variant`: the keyboard layout variant (for example, `qwerty`)
* `metadata.variantName`: the display name of the layout variant (for example, `QWERTY`)
* `states`: an object containing the various keyboard states