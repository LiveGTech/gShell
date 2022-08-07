/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as aui_a11y from "gshell://lib/adaptui/src/a11y.js";
import Fuse from "gshell://lib/fuse.esm.js";

import * as a11y from "gshell://a11y/a11y.js";
import * as device from "gshell://system/device.js";
import * as config from "gshell://config/config.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

// Also in `shell/webviewpreload.js`
export const NON_TEXTUAL_INPUTS = [
    "button",
    "checkbox",
    "color",
    "date",
    "datetime-local",
    "file",
    "hidden",
    "image",
    "month",
    "radio",
    "range",
    "reset",
    "submit",
    "time",
    "week"
];

export const TRAILING_PUNCTUATION = ["-", ",", ".", "!", "?", ":", ";", "<", ">"];

export const MAX_INPUT_ENTRY_BUFFER_LENGTH = 128;
export const N_GRAM_DICTIONARY_SEPARATOR = "\u241E";

export const inputModes = {
    NONE: 0,
    FULL_KEYBOARD: 1,
    IME_ONLY: 2,
    FLOATING_KEYBOARD: 3
};

export const candidateResultSources = {
    WORD: 0,
    N_GRAM: 1
};

export var keyboardLayouts = [];
export var inputMethods = [];
export var currentKeyboardLayout = null;
export var showing = false;
export var targetInputSurface = null;
export var inputEntryBuffer = [];
export var inputEntryWordLength = 0;
export var inputCharsToEnter = 0;
export var inputTrailingText = "";
export var inputMethodEditorElement = null;

var targetInput = null;
var showingTransition = false;
var lastInputScrollLeft = 0;
var lastInputTop = 0;
var lastInputLeft = 0;
var lastInputWidth = 0;
var lastInputHeight = 0;

export class KeyboardLayout {
    constructor(localeCode, variant, metadata = {}, path = null) {
        this.localeCode = localeCode;
        this.variant = variant;
        this.metadata = metadata;
        this.path = path;

        this.states = {};
        this.defaultState = null;
        this.shiftState = null;
        this.currentState = null;
        this.allInputMethodPaths = [];
        this.inputMethodPaths = [];
        this.inputMethods = [];
        this.currentInputMethod = null;
        this.capsLockActive = false;
    }

    static deserialise(data, path = null, inputMethodPaths = null) {
        var instance = new this(data.localeCode, data.variant, data.metadata, path);

        instance.states = data.states || {};
        instance.defaultState = data.defaultState || null;
        instance.shiftState = data.shiftState || null;
        instance.currentState = instance.defaultState;
        instance.allInputMethodPaths = data.inputMethodPaths || [];
        instance.inputMethodPaths = inputMethodPaths || instance.allInputMethodPaths.slice(0, 1);

        instance.loadInputMethods();

        return instance;
    }

    get shiftActive() {
        return this.currentState == this.shiftState;
    }

    set shiftActive(value) {
        this.currentState = value ? this.shiftState : this.defaultState;
    }

    toggleShift(includeCapsLock = false) {
        if (includeCapsLock && this.shiftActive && !this.capsLockActive) {
            this.capsLockActive = true;
        } else {
            this.shiftActive = !this.shiftActive;
            this.capsLockActive = false;
        }

        this.onStateUpdate();
    }

    onStateUpdate() {}

    loadInputMethods() {
        var thisScope = this;

        return Promise.all(this.inputMethodPaths.map(function(path) {
            return fetch(path).then(function(response) {
                return response.json();
            }).then(function(data) {
                var inputMethod = InputMethod.deserialise(data, path);

                thisScope.inputMethods.push(inputMethod);

                if (thisScope.currentInputMethod == null) {
                    thisScope.currentInputMethod = inputMethod;

                    return thisScope.render();
                }

                return Promise.resolve();
            });
        }));
    }

    render() {
        var thisScope = this;

        return $g.create("div")
            .addClass("input_keyboard_keys")
            .add(
                ...(this.states[this.currentState] || []).map(function(row) {
                    var rowElement = $g.create("div").addClass("input_keyboard_row");
                    var nextToken = "";

                    function matchesToken(token) {
                        var matches = row.match(new RegExp(`^(?:${token})`));

                        if (matches) {
                            nextToken = matches[0];
                            row = row.substring(matches[0].length);

                            return true;
                        }

                        return false;
                    }

                    function keyEventFactory(keyCode, modifiers = [], interpretShift = false) {
                        if (interpretShift && keyCode.toUpperCase() == keyCode) {
                            modifiers.push("Shift");
                        }

                        return function() {
                            var webContentsId = getWebContentsId();

                            if (TRAILING_PUNCTUATION.includes(keyCode)) {
                                removeTrailingText();
                            }

                            ["keyDown", "char", "keyUp"].forEach(function(type) {
                                if (type == "char" && ["Enter"].includes(keyCode)) {
                                    return;
                                }

                                gShell.call("io_input", {webContentsId, event: {type, keyCode, modifiers}});
                            });

                            if (thisScope.shiftActive && !thisScope.capsLockActive) {
                                thisScope.shiftActive = false;

                                thisScope.onStateUpdate();
                            }
                        };
                    }

                    while (row.length > 0) {
                        var key = $g.create("button");

                        function setKeyAction(callback, returnToKeyWhenSwitchEnabled) {
                            key.on("click", function(event) {
                                if (!a11y.options.switch_enabled) {
                                    targetInput?.focus();
                                }

                                callback(event);

                                returnToTargetInput(returnToKeyWhenSwitchEnabled);
                            });
                        }

                        if (matchesToken("{\\.lm}")) {
                            key.addClass("input_keyboard_landmark");

                            (function(key) {
                                function getLandmarkedKeys() {
                                    var landmarkedKeys = [];
                                    var currentLandmarkedKey = key;
    
                                    do {
                                        currentLandmarkedKey = currentLandmarkedKey.next("button");
    
                                        landmarkedKeys.push(currentLandmarkedKey);
                                    } while (currentLandmarkedKey.getAll().length > 0 && currentLandmarkedKey.is("button:not(.input_keyboard_landmark"))

                                    landmarkedKeys.pop(); // The next landmark
    
                                    return landmarkedKeys;
                                }
    
                                key.on("focus", function() {
                                    var landmarkedKeys = getLandmarkedKeys();
    
                                    if (landmarkedKeys.length == 0) {
                                        return;
                                    }
    
                                    var originRect = rowElement.get().getBoundingClientRect();
                                    var firstLandmarkedKeyRect = landmarkedKeys[0].get().getBoundingClientRect();
                                    var lastLandmarkedKeyRect = landmarkedKeys[landmarkedKeys.length - 1].get().getBoundingClientRect();
    
                                    key.setStyle("top", `${firstLandmarkedKeyRect.top - originRect.top}px`);
                                    key.setStyle("left", `${firstLandmarkedKeyRect.left - originRect.left}px`);
                                    key.setStyle("width", `${lastLandmarkedKeyRect.right - firstLandmarkedKeyRect.left}px`);
                                    key.setStyle("height", `${lastLandmarkedKeyRect.bottom - firstLandmarkedKeyRect.top}px`);

                                    landmarkedKeys.forEach((key) => key.setAttribute("tabindex", "-1"));
                                });

                                key.on("click", function() {
                                    var landmarkedKeys = getLandmarkedKeys();

                                    landmarkedKeys.forEach((key) => key.removeAttribute("tabindex"));

                                    landmarkedKeys[0]?.focus();
                                });
                            })(key);

                            rowElement.add(key);

                            continue;
                        }

                        if (matchesToken("{.*?}")) {
                            var args = nextToken.substring(1, nextToken.length - 1).split(":");
                            var keyType = args.shift();

                            switch (keyType) {
                                case ".shift":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark embedded")
                                            .setAttribute("src", 
                                                thisScope.capsLockActive ?
                                                "gshell://lib/adaptui/icons/key-capslock.svg" :
                                                "gshell://lib/adaptui/icons/key-shift.svg"
                                            )
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_shift"));

                                    setKeyAction(function() {
                                        thisScope.toggleShift(true);
                                    });

                                    break;

                                case ".backspace":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark embedded")
                                            .setAttribute("src", "gshell://lib/adaptui/icons/key-backspace.svg")
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_backspace"));

                                    setKeyAction(keyEventFactory("Backspace"), true);

                                    break;

                                case ".space":
                                    key.addClass("input_keyboard_spaceKey");

                                    key.add($g.create("div"));

                                    key.setAttribute("aria-label", _("input_key_space"));

                                    setKeyAction(keyEventFactory(" "));

                                    break;

                                case ".enter":
                                    key.addClass("input_keyboard_iconKey");

                                    key.add(
                                        $g.create("img")
                                            .setAttribute("aui-icon", "dark embedded")
                                            .setAttribute("src", "gshell://lib/adaptui/icons/key-enter.svg")
                                            .setAttribute("alt", "")
                                    );

                                    key.setAttribute("aria-label", _("input_key_enter"));

                                    setKeyAction(keyEventFactory("Enter"));

                                    break;

                                case "":
                                    key = $g.create("span");

                                    break;

                                case ".u":
                                    keyType = String.fromCodePoint(args.shift().split(",").map((codePoint) => parseInt(codePoint, 16)));

                                    // Continue to default behaviour since Unicode string has been assembled

                                default:
                                    key.setText(keyType);

                                    (function(targetAction) {
                                        setKeyAction(function(event) {
                                            if (targetAction.startsWith("@")) {
                                                thisScope.currentState = targetAction.substring(1);
    
                                                thisScope.onStateUpdate();
    
                                                return;
                                            }
    
                                            keyEventFactory(targetAction, [], true)(event);
                                        });
                                    })(args.shift() || keyType);

                                    break;
                            }

                            key.setStyle("width", `${(Number(args.shift()) || 1) * 100}%`);

                            rowElement.add(key);

                            continue;
                        }

                        matchesToken(".");

                        setKeyAction(keyEventFactory(nextToken, [], true));

                        rowElement.add(
                            key.setText(nextToken)
                        );
                    }

                    return rowElement;
                })
            )
        ;
    }
}

export class InputMethod {
    constructor(localeCode, type = "default", metadata = {}, path = null) {
        this.localeCode = localeCode;
        this.type = type;
        this.metadata = metadata;
        this.path = path;

        this.wordSeparator = metadata.wordSeparator || " "; // Set as `""` for ideographic languages since they don't have spaces
        this.nGramLength = metadata.nGramLength || 4;
        this.allowPartialWords = metadata.allowPartialWords || false;

        this.remainingWordPart = "";

        this.nGramDictionary = {};
        this.wordDictionary = [];

        this.wordInputs = [];
        this.wordFuse = null;

        this.reindexDictionaries();
    }

    static deserialise(data, path = null) {
        var instance = new this(data.localeCode, data.type, data.metadata, path);

        instance.nGramDictionary = data.nGramDictionary || {};
        instance.wordDictionary = data.wordDictionary || [];

        instance.reindexDictionaries();

        return instance;
    }

    reindexDictionaries() {
        this.wordInputs = [...new Set(this.wordDictionary.map((result) => result.input))];

        this.wordFuse = new Fuse(this.wordDictionary, {
            keys: ["input"],
            includeScore: true,
            distance: 3
        });
    }

    getInputWord(buffer = inputEntryBuffer, wordLength = inputEntryWordLength) {
        return buffer.slice(Math.max(buffer.length - wordLength, 0)).join("");
    }

    getPartialWord(fullWord) {
        if (!this.allowPartialWords) {
            return fullWord;
        }

        var startingInputs = this.wordInputs.filter((word) => fullWord.startsWith(word));

        // Find the longest matching partial word first
        return startingInputs.sort((a, b) => b.length - a.length)[0] || fullWord;
    }

    getNGram(buffer = inputEntryBuffer, entryWordLength = inputEntryWordLength, nGramLength = this.nGramLength) {
        var inputWord = this.getInputWord(buffer, entryWordLength);
        var partialWord = this.getPartialWord(inputWord);

        this.remainingWordPart = inputWord.substring(partialWord.length);
        inputWord = partialWord;

        if (this.wordSeparator == "") {
            buffer = buffer.slice(0, Math.max(buffer.length - entryWordLength, 0));
        }

        var lastSentence = buffer.join("");

        TRAILING_PUNCTUATION.forEach(function(char) {
            var splitSentence = lastSentence.split(char);

            lastSentence = splitSentence[splitSentence.length - 1];
        });

        lastSentence = lastSentence.trimStart();

        var words = lastSentence.split(this.wordSeparator);
        var nGram = words.slice(Math.max(words.length - nGramLength, 0), words.length).map((word) => word.toLocaleLowerCase());

        if (this.wordSeparator == "") {
            nGram.push(inputWord);
        }

        return nGram;
    }

    getCandidates(nGramLength = this.nGramLength) {
        var nGramResults = this.nGramDictionary[this.getNGram(inputEntryBuffer, inputEntryWordLength, nGramLength).join(N_GRAM_DICTIONARY_SEPARATOR)] || [];
        var wordResults = this.wordFuse.search(this.getPartialWord(this.getInputWord()));
        var allCandidates = [];

        wordResults.forEach(function(result) {
            result.item.score = result.item.weighting * (1 - result.score);
            result.item.source = candidateResultSources.WORD;

            allCandidates.push(result.item);
        });

        nGramResults.forEach(function(result) {
            result.source = candidateResultSources.N_GRAM;
            result.score = result.weighting;
        });

        allCandidates.push(...nGramResults);

        if (allCandidates.length == 0) {
            allCandidates.push(...(this.nGramDictionary[""] || []));
        }

        return Promise.resolve(allCandidates.sort((a, b) => b.score - a.score));
    }

    selectCandidate(candidate) {
        var charsToDelete = inputEntryWordLength;

        targetInput?.focus();

        for (var i = 0; i < charsToDelete; i++) {
            ["keyDown", "char", "keyUp"].forEach(function(type) {
                gShell.call("io_input", {webContentsId: getWebContentsId(), event: {type, keyCode: "Backspace"}});
            });

            inputEntryBuffer.pop();

            inputCharsToEnter++;
        }

        inputCharsToEnter += [...candidate.result, ...this.wordSeparator].length;

        [...candidate.result, ...this.wordSeparator, ...this.remainingWordPart].forEach(function(char) {
            ["keyDown", "char", "keyUp"].forEach(function(type) {
                if (type == "char" && ["Enter"].includes(char)) {
                    return;
                }
    
                gShell.call("io_input", {webContentsId: getWebContentsId(), event: {type, keyCode: char}});

                if (type == "keyDown") {
                    inputEntryBuffer.push(char);
                }
            });
        });

        returnToTargetInput();

        inputEntryWordLength = 0;
        inputTrailingText = this.wordSeparator;

        updateInputMethodEditor();
    }
}

export function updateInputMethodEditor() {
    if (currentKeyboardLayout == null || currentKeyboardLayout.currentInputMethod == null) {
        inputMethodEditorElement.clear();
        
        return;
    }

    return currentKeyboardLayout.currentInputMethod.getCandidates().then(function(candidates) {
        return currentKeyboardLayout.currentInputMethod.getCandidates(2).then(function(baseCandidates) {
            candidates = candidates.slice(0, 3);

            inputMethodEditorElement.clear().add(
                ...[...candidates, ...baseCandidates.slice(0, Math.max(3 - candidates.length, 0))].map((candidate) => $g.create("button")
                    .setAttribute("dir", $g.sel("html").getAttribute("dir") == "rtl" ? "ltr" : "rtl") // So that only the end of the word is shown
                    .setText(candidate.result)
                    .on("click", function() {
                        currentKeyboardLayout.currentInputMethod.selectCandidate(candidate);
                        updateInputMethodEditor();
                    })
                )
            );
    
            return Promise.resolve();
        });
    });
}

function keydownCallback(event) {
    function reset() {
        inputEntryBuffer = [];
        inputEntryWordLength = 0;
    }

    if (event.key == "Tab") {
        return;
    }

    if (event.key == " " && $g.sel(document.activeElement).is(".input *")) {
        return;
    }

    if (inputCharsToEnter > 0) {
        inputCharsToEnter--;

        return;
    }

    inputTrailingText = "";

    if ([...event.key].length == 1 && !event.ctrlKey && !event.altKey) { // Printable key
        while (inputEntryBuffer.length > MAX_INPUT_ENTRY_BUFFER_LENGTH) {
            inputEntryBuffer.shift();
        }

        inputEntryBuffer.push(event.key);

        if ([" ", ...TRAILING_PUNCTUATION].includes(event.key)) {
            inputEntryWordLength = 0;
        } else {
            inputEntryWordLength++;
        }

        updateInputMethodEditor();

        return;
    }
    
    if (event.key == "Backspace") {
        if (event.ctrlKey || event.altKey || event.shiftKey) {
            reset();
            updateInputMethodEditor();

            return;
        }

        inputEntryBuffer.pop();

        inputEntryWordLength = Math.max(inputEntryWordLength - 1, 0);

        updateInputMethodEditor();

        return;
    }

    reset();
    updateInputMethodEditor();
}

export function init() {
    inputMethodEditorElement = $g.create("div")
        .addClass("input_keyboard_row")
        .addClass("input_ime")
    ;

    setInterval(function() {
        lastInputScrollLeft = document.activeElement.scrollLeft;

        if (document.activeElement?.matches(".input, .input *")) {
            return;
        }

        targetInputSurface = document.activeElement;
    });

    $g.sel("body").on("click", function(event) {
        if (a11y.options.switch_enabled) {
            return;
        }

        if (!event.target.matches("body *")) { // Elements removed from DOM won't match to `.input *` etc.
            return;
        }

        if (event.target.matches("label, .input, .input *, [inputmode='none']")) { // TODO: Support `inputmode` and not just `type`
            return;
        }

        if (event.target.matches("input")) {
            if (!isTextualInput($g.sel(event.target))) {
                hide();

                return;
            }

            event.target.focus();

            show();

            return;
        }

        hide();

        return;
    });

    $g.sel("body").on("focusout", function(event) {
        if (isTextualInput($g.sel(event.target))) {
            event.target.scrollLeft = lastInputScrollLeft;
        }
    });

    $g.sel("body").on("click", function(event) {
        if (isTextualInput($g.sel(event.target)) && a11y.options.switch_enabled) {
            event.target.focus();

            setTimeout(function() {
                show();
            });
        }
    });

    webviewComms.onEvent("focusin click", function(event) {
        var webviewRect = event.targetWebview.getBoundingClientRect();

        lastInputTop = webviewRect.top + event.targetTop;
        lastInputLeft = webviewRect.left + event.targetLeft;
        lastInputWidth = event.targetWidth;
        lastInputHeight = event.targetHeight;
    });

    $g.sel(".input").on("click", function(event) {
        if (event.target.matches("button")) {
            return;
        }

        targetInputSurface?.focus();

        event.preventDefault();
    });

    $g.sel("body").on("keydown", keydownCallback);
    webviewComms.onEvent("keydown", keydownCallback);

    loadKeyboardLayoutsFromConfig();
}

export function clearKeyboardLayouts() {
    keyboardLayouts = [];
    currentKeyboardLayout = null;
}

export function loadKeyboardLayout(path, inputMethodPaths = null) {
    return fetch(path).then(function(response) {
        return response.json();
    }).then(function(data) {
        var keyboard = KeyboardLayout.deserialise(data, path, inputMethodPaths);

        keyboard.onStateUpdate = function() {
            render();

            $g.sel(".input").find(aui_a11y.FOCUSABLES).first().focus();
        };

        keyboardLayouts = keyboardLayouts.filter((layout) => layout.path != path);

        keyboardLayouts.push(keyboard);

        if (currentKeyboardLayout == null) {
            currentKeyboardLayout = keyboard;

            return render();
        }

        return Promise.resolve();
    });
}

export function loadKeyboardLayoutsFromConfig() {
    clearKeyboardLayouts();

    return config.read("input.gsc").then(function(data) {
        return Promise.all((
            data.keyboardLayouts || [{path: "gshell://input/layouts/en_GB_qwerty.gkbl"}]
        ).map(function(layoutData) {
            return loadKeyboardLayout(layoutData.path, layoutData.inputMethodPaths || null);
        }));
    });
}

export function getKeyboardLayoutDataForLocale(localeCode) {
    return fetch("gshell://input/l10nmappings.json").then(function(response) {
        return response.json();
    }).then(function(data) {
        return Promise.all((data.mappings[localeCode] || []).map(function(path) {
            return fetch(path).then(function(response) {
                return response.json();
            }).then(function(layout) {
                return {path, layout};
            });
        }))
    });
}

export function getWebContentsId() {
    var webContentsId = 1;

    if (targetInputSurface.matches("webview")) {
        webContentsId = targetInputSurface.getWebContentsId();
    }

    return webContentsId;
}

export function isTextualInput(element) {
    return element.is("input") && !(NON_TEXTUAL_INPUTS.includes(String(element.getAttribute("type") || "").toLowerCase()));
}

export function removeTargetInput() {
    targetInput = null;
}

export function returnToTargetInput(returnToKeyWhenSwitchEnabled = false) {
    var lastInputFocus = $g.sel(document.activeElement);

    targetInput?.focus();

    if (a11y.options.switch_enabled) {
        setTimeout(function() {
            $g.sel(document.activeElement).blur();

            if (returnToKeyWhenSwitchEnabled) {
                lastInputFocus.focus();
            } else {
                $g.sel(".input").find(aui_a11y.FOCUSABLES).first().focus();
            }
        }, 100);
    }
}

export function removeTrailingText() {
    for (var i = 0; i < inputTrailingText.length; i++) {
        ["keyDown", "char", "keyUp"].forEach(function(type) {
            gShell.call("io_input", {webContentsId: getWebContentsId(), event: {type, keyCode: "Backspace"}});
        });
    }

    inputTrailingText = "";

    returnToTargetInput(true);
}

export function render() {
    $g.sel(".input")
        .clear()
        .add(
            inputMethodEditorElement,
            currentKeyboardLayout.render(),
            $g.create("div")
                .addClass("input_keyboard_row")
                .addClass("input_keyboard_options")
                .add(
                    $g.create("button")
                        .addClass("input_keyboard_iconKey")
                        .setAttribute("title", _("input_option_hide"))
                        .setAttribute("aria-label", _("input_option_hide"))
                        .on("click", hide)
                        .add(
                            $g.create("img")
                                .setAttribute("aui-icon", "dark embedded")
                                .setAttribute("src", "gshell://lib/adaptui/icons/hidekeyboard.svg")
                                .setAttribute("alt", "")
                        )
                    ,
                    $g.create("button") // TODO: Implement emoji
                        .addClass("input_keyboard_iconKey")
                        .setAttribute("title", _("input_option_emoji"))
                        .setAttribute("aria-label", _("input_option_emoji"))
                        .add(
                            $g.create("img")
                                .setAttribute("aui-icon", "dark embedded")
                                .setAttribute("src", "gshell://lib/adaptui/icons/emoji.svg")
                                .setAttribute("alt", "")
                        )
                )
        )
    ;
}

export function getBestInputMode() {
    if (device.touchActive) {
        return inputModes.FULL_KEYBOARD;
    }

    if (a11y.options.switch_enabled && device.data?.type == "desktop") {
        return inputModes.FLOATING_KEYBOARD;
    }

    return inputModes.IME_ONLY;
}

export function show(mode = getBestInputMode()) {
    if (mode == inputModes.NONE) {
        return;
    }

    targetInput = document.activeElement;

    showing = true;
    showingTransition = true;

    if (mode == inputModes.IME_ONLY) {
        $g.sel(".input").addClass("imeOnly");
    } else {
        $g.sel(".input").removeClass("imeOnly");
    }

    if (mode == inputModes.FLOATING_KEYBOARD) {
        $g.sel(".input").addClass("floating");
    } else {
        $g.sel(".input").removeClass("floating");
    }

    if ([inputModes.IME_ONLY, inputModes.FLOATING_KEYBOARD].includes(mode)) {
        $g.sel(".input").setStyle("bottom", null);

        if (!$g.sel(document.activeElement).is("webview")) {
            var elementRect = document.activeElement.getBoundingClientRect();

            lastInputTop = elementRect.top;
            lastInputLeft = elementRect.left;
            lastInputWidth = elementRect.width;
            lastInputHeight = elementRect.height;
        }

        var top = lastInputTop + lastInputHeight + 5;
        var inputHeight = parseInt(getComputedStyle($g.sel(".input").get()).height);

        if (top + inputHeight > window.innerHeight) {
            top = lastInputTop - inputHeight - 5;
        }

        $g.sel(".input").setStyle("top", `${top}px`);
        $g.sel(".input").setStyle("left", `${lastInputLeft}px`);
    } else {
        $g.sel("body").addClass("input_keyboardShowing");
    }

    updateInputMethodEditor();

    webviewComms.update();

    if (a11y.options.switch_enabled) {
        a11y.assistiveTechnologies.filter((tech) => tech instanceof a11y.modules.switch?.SwitchNavigation).forEach(function(tech) {
            tech.startItemScan();
        });

        $g.sel(".input").removeAttribute("hidden");

        $g.sel(".input").find(aui_a11y.FOCUSABLES).first().focus();

        aui_a11y.setFocusTrap($g.sel(".input").get());
    }

    return Promise.all([
        $g.sel(".input").fadeIn(250),
        ...(mode != inputModes.IME_ONLY ? [$g.sel(".input").easeStyleTransition("bottom", 0, 250)] : [])
    ]).then(function() {
        showingTransition = false;

        if (targetInputSurface?.matches("webview")) {
            targetInputSurface.send("input_scrollIntoView");
        } else {
            targetInput.scrollIntoView({block: "nearest", inline: "nearest"});
        }
    });
}

export function hide(force = false) {
    if (!force && showingTransition) {
        return;
    }

    aui_a11y.clearFocusTrap();

    showing = false;

    targetInput?.focus();

    if (targetInput?.matches("input")) {
        targetInput.scrollLeft = 0;
    }

    targetInput = null;

    $g.sel("body").removeClass("input_keyboardShowing");

    webviewComms.update();

    return Promise.all([
        $g.sel(".input").fadeOut(250),
        ...(!$g.sel(".input").hasClass("imeOnly") ? [$g.sel(".input").easeStyleTransition("bottom", -20, 250)] : [])
    ]).then(function() {
        if (showingTransition) {
            $g.sel(".input").show();
        } else {
            $g.sel(".input").removeClass("imeOnly");
        }
    });
}