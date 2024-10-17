# Input Method Editor
The Input Method Editor (IME) is an integrated tool for gShell which provides a virtual, on-screen keyboard, text autocorrection, predictive text input, and CJK character input from romanised text entry.

## Virtual keyboard layouts
Built-in virtual keyboard layouts are stored in `shell/input/layouts` and those layout files are named with the scheme `<localeCode>_<variant>.gkbl`, where `<localeCode>` is the locale code (from files named in `shell/locales`) and `<variant>` is the keyboard layout variant, such as `qwerty` for QWERTY.

Layout files are written in the JSON text format. Comprehensive examples of layout files can be found in `shell/input/layouts`. The main values are:

* `localeCode`: the locale code associated with the keyboard layout (for example, `en_GB`)
* `variant`: the keyboard layout variant (for example, `qwerty`)
* `metadata.variantName`: the display name of the layout variant (for example, `QWERTY`)
* `inputMethodPaths` (optional): an array of URLs to relevant input methods that would be used with this virtual keyboard (such as the Pinyin input method for a Chinese QWERTY keyboard layout)
* `states`: an object containing the various keyboard states
* `defaultState`: the default keyboard layout state to use when the input is shown
* `shiftState`: the state to toggle when a key of type `.shift` is pressed

### Keyboard state format
A keyboard state is defined in JSON as an array of strings. Each string in the array represents the row of the keyboard in the given state: the first string in the array represents the top row, and the last string represents the bottom row.

All states are stored in the `states` object along with their state name (such as `lowercase` and `uppercase`) in a JSON object.

### Special keys
Each Unicode character in a row string represents one key of a keyboard, with the exception of text wrapped in brace brackets (`{` and `}`). Text wrapped in brace brackets represent **special keys** which may reprsent the entry of multiple characters at once, dead keys (such as for accent entry) or keys that perform actions (such as switching to a different state).

Below is an overview of the format of special keys. The idea of a 'key width' (as referenced below) is relative to the number of keys in a row that are distributed with equal width.

#### `{▲:■}`
Creates a key comprised of the text ▲ that inserts ■ when pressed.

#### `{▲:@■}`
Creates a key comprised of the text ▲ that switches to the state with the name ■ when pressed.

#### `{.shift}`
Toggles whether the shift state (state whose name is the value of property `shiftState`) should be shown: if used in a non-shift state, the key's action will be to switch to the shift state; but if used in the shift state, the key will switch to the default state (state whose name is the value of property `defaultState`).

#### `{.backspace}`
Acts as the backspace key of a keyboard; deleting characters to the left of the caret, or deleting selected text.

#### `{.space}`
Acts as the space key of a keyboard; inserting a space character (` `).

#### `{.enter}`
Acts as the enter key of a keyboard; inserting a newline character, or confirming an action.

#### `{:▲}`
Used as a spacer, and is not a key. The spacer will be given a width that spans ▲ keys (for example, using `{:1}` will add space to the row that spans one key in width).

#### `{.u:▲}`
Creates a key comprised of the Unicode characters defined as a comma-delimited (`,`) list of codepoints ▲ (for example, `{.u:1f636,200d,1f32b,fe0f}` will insert the face in clouds (😶‍🌫️) emoji).

#### `{.lm}`
Used as a landmark for [Switch Navigation](a11y.md#switchnavigationswitchjs) accessibility that groups all keys after it (up until the next landmark) for faster text entry, and so is not key in itself (but represents a group of keys).

#### `{.▲:■}`
The key with action ▲ will be given a width that spans ■ keys (for exmple, using `{.enter:2}` will create an enter key that spans two keys in width).

## Input method data
Training data for input methods are located under `gshell://input/imedata` and are used by the IME to provide text input for CJK languages, and typing suggestions for other languages. The IME is used regardless of whether the virtual keyboard is active, since it lets users that use a standard ISO or ANSI keyboard to enter text in cases where characters in their language do not correspond to the characters shown on the keyboard (such as with Chinese). However, for non-CJK languages, the IME is rarely used on desktop for typing suggestions (with the exception of being enabled for Switch Navigation to make text entry faster).

Training data is gathered from large corpuses of text, such as from articles on the internet or specialised (conversational) training data. This variation in training corpuses allows the IME to be used in various contexts and circumstances, since a conversational text corpus may not be as helpful at suggesting phrases when being used to write a formal document.

IME training is performed in our specialised [IME Training](https://github.com/LiveGTech/IMETraining) repository.