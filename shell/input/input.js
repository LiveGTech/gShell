/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as aui_a11y from "gshell://lib/adaptui/src/a11y.js";
import MiniSearch from "gshell://lib/minisearch.min.js";

import * as l10n from "gshell://config/l10n.js";
import * as a11y from "gshell://a11y/a11y.js";
import * as device from "gshell://system/device.js";
import * as config from "gshell://config/config.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

// Also in `shell/webviewpreload.js`
export const INPUT_SELECTOR = `input, textarea, [contenteditable], [aria-role="input"]`;

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
export const MAX_WORD_MATCH_LENGTH = 10;
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
export var currentKeyboardLayout = null;
export var showing = false;
export var showingMode = inputModes.NONE;
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
var lastInputMethodCandidates = [];

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

    serialise() {
        return {
            localeCode: this.localeCode,
            variant: this.variant,
            metadata: this.metadata,
            states: this.states,
            defaultState: this.defaultState,
            shiftState: this.shiftState,
            currentState: this.currentState,
            allInputMethodPaths: this.allInputMethodPaths,
            inputMethodPaths: this.inputMethodPaths
        };
    }

    serialiseForOptionSelection() {
        return {
            ...this.serialise(),
            path: this.path,
            inputMethods: this.inputMethods.map((inputMethod) => inputMethod.serialiseForOptionSelection())
        };
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

        var inputMethodsToAdd = [];

        return Promise.all(this.inputMethodPaths.map(function(path) {
            return fetch(path).then(function(response) {
                return response.json();
            }).then(function(data) {
                var inputMethod = InputMethod.deserialise(data, path);

                inputMethodsToAdd.push(inputMethod);

                if (thisScope.currentInputMethod == null) {
                    thisScope.currentInputMethod = inputMethod;

                    return thisScope.render();
                }

                return Promise.resolve();
            });
        })).then(function() {
            thisScope.inputMethods = inputMethodsToAdd;

            return Promise.resolve();
        });
    }

    loadAllInputMethods() {
        this.inputMethodPaths = [...this.allInputMethodPaths];

        return this.loadInputMethods();
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

        this.wordSeparator = metadata.wordSeparator ?? " "; // Set as `""` for ideographic languages since they don't have spaces
        this.nGramLength = metadata.nGramLength || 4;
        this.allowPartialWords = metadata.allowPartialWords || false;
        this.maxCandidates = metadata.maxCandidates || 3;

        this.remainingWordPart = "";

        this.nGramDictionary = {};
        this.wordDictionary = [];

        this.wordInputs = [];
        this.wordSearch = null;

        this.reindexDictionaries();
    }

    serialiseForOptionSelection() {
        return {
            localeCode: this.localeCode,
            type: this.type,
            metadata: this.metadata,
            path: this.path
        };
    }

    serialise() {
        return {
            ...this.serialiseForOptionSelection(),
            path: undefined,
            nGramDictionary: this.nGramDictionary,
            wordDictionary: this.wordDictionary
        };
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

        this.wordSearch = new MiniSearch({
            idField: "input",
            fields: ["input"],
            storeFields: ["input", "result", "weighting"]
        });

        this.wordSearch.addAll(this.wordDictionary);
    }

    getInputWord(buffer = inputEntryBuffer, wordLength = inputEntryWordLength) {
        return buffer.slice(Math.max(buffer.length - wordLength, 0)).join("");
    }

    getPartialWord(fullWord) {
        if (!this.allowPartialWords) {
            return fullWord;
        }

        var startingInputs = this.wordInputs.filter((word) => fullWord.startsWith(word));

        // TODO: Find a way of searching through characters instead of words and then use n-grams to perform completion

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
        var thisScope = this;

        var nGramResults = this.nGramDictionary[this.getNGram(inputEntryBuffer, inputEntryWordLength, nGramLength).join(N_GRAM_DICTIONARY_SEPARATOR)] || [];
        var wordResults = this.wordSearch.search(this.getPartialWord(this.getInputWord()).substring(0, MAX_WORD_MATCH_LENGTH), {prefix: true, fuzzy: 0.2});
        var allCandidates = [];

        var wordResultsMaxScore = wordResults.sort((a, b) => b.score - a.score)[0]?.score || 1;

        wordResults.forEach(function(result) {
            result = {...result};

            result.score = result.weighting * (result.score / wordResultsMaxScore);
            result.source = candidateResultSources.WORD;

            if (result.score > 0.5) {
                var inputLengthDifference = Math.max(result.input.length - thisScope.getInputWord().length, 0);
                var inputLengthDifferenceScore = Math.E ** (-(1 / 2) * ((((inputLengthDifference / result.input.length) - 0.25) / 0.5) ** 2)); // Bell curve with peak at 0.25

                console.log(result.input, thisScope.getInputWord(), inputLengthDifferenceScore);

                result.score += (1 - result.score) * 0.1 * inputLengthDifferenceScore;
            }

            allCandidates.push(result);
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

    getAllCandidates(baseNgramLength = 2) {
        var thisScope = this;

        return this.getCandidates().then(function(candidates) {
            return thisScope.getCandidates(baseNgramLength).then(function(baseCandidates) {
                return Promise.resolve([...candidates, ...baseCandidates]);
            });
        });
    }

    selectCandidate(candidate, discardSuffixLength = 0) {
        var charsToDelete = inputEntryWordLength + discardSuffixLength;

        targetInput?.focus();

        for (var i = 0; i < charsToDelete; i++) {
            ["keyDown", "char", "keyUp"].forEach(function(type) {
                gShell.call("io_input", {webContentsId: getWebContentsId(), event: {type, keyCode: "Backspace"}});
            });

            inputEntryBuffer.pop();

            inputCharsToEnter++;
        }

        inputCharsToEnter += [...candidate.result, ...this.wordSeparator].length;

        [...candidate.result, ...this.wordSeparator, ...this.remainingWordPart].forEach(function(char, i) {
            ["keyDown", "char", "keyUp"].forEach(function(type) {
                if (type == "char" && ["Enter"].includes(char)) {
                    return;
                }
    
                gShell.call("io_input", {webContentsId: getWebContentsId(), event: {type, keyCode: char}});

                if (type == "keyDown" && i < candidate.result.length) {
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

    return currentKeyboardLayout.currentInputMethod.getAllCandidates().then(function(candidates) {
        var maxCandidates = currentKeyboardLayout.currentInputMethod.maxCandidates;

        candidates = candidates.slice(0, maxCandidates);

        lastInputMethodCandidates = candidates;

        inputMethodEditorElement.clear().add(
            ...candidates
                .sort((a, b) => b.weighting - a.weighting)
                .slice(0, Math.max(maxCandidates, 0))
                .map((candidate, i) => $g.create("button")
                    .on("click", function() {
                        currentKeyboardLayout.currentInputMethod.selectCandidate(candidate);
                        updateInputMethodEditor();
                    })
                    .add(
                        i < 10 ? $g.create("span")
                            .addClass("input_imeCandidateKey")
                            .add(
                                $g.create("span").setText(_format(i + 1))
                            )
                        : $g.create("span"),
                        $g.create("span")
                            .addClass("input_imeCandidateResult")
                            .setAttribute("dir", $g.sel("html").getAttribute("dir") == "rtl" ? "ltr" : "rtl") // So that only the end of the word is shown
                            .setText(candidate.result)
                    )
                )
        );

        return Promise.resolve();
    });
}

export function selectInputMethodEditorCandiate(index = 0, discardSuffixLength = 0) {
    if (currentKeyboardLayout == null || currentKeyboardLayout.currentInputMethod == null) {
        return;
    }

    var inputMethod = currentKeyboardLayout.currentInputMethod;

    return inputMethod.selectCandidate(lastInputMethodCandidates[index], discardSuffixLength);
}

function keydownCallback(event) {
    function reset() {
        inputEntryBuffer = [];
        inputEntryWordLength = 0;
    }

    if (event.key == "Tab") {
        return;
    }

    if (showing && showingMode == inputModes.IME_ONLY && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        // TODO: Allow entry of numbers when there are no available candidates

        if (event.keyCode >= 48 && event.keyCode <= 48 + Math.min(currentKeyboardLayout?.currentInputMethod?.maxCandidates || 3, 10)) {
            selectInputMethodEditorCandiate(event.keyCode - 48 - 1, 1);
        }

        if (event.key == " " && currentKeyboardLayout?.currentInputMethod?.wordSeparator != " ") {
            selectInputMethodEditorCandiate(0, 1);
        }
    }

    if (event.key == " " && $g.sel(document.activeElement).is(".input *")) {
        if (inputTrailingText == " ") {
            // Fix for counter not going back to 0 when using Switch Navigation a11y
            inputCharsToEnter = 0;
        }

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

        if (showing || document.activeElement?.matches(".input, .input *")) {
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

        if (event.target.matches(INPUT_SELECTOR)) {
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

export function loadKeyboardLayout(path, inputMethodPaths = null, addToList = true) {
    return fetch(path).then(function(response) {
        return response.json();
    }).then(function(data) {
        var keyboard = KeyboardLayout.deserialise(data, path, inputMethodPaths);

        keyboard.onStateUpdate = function() {
            render();

            $g.sel(".input").find(aui_a11y.FOCUSABLES).first().focus();
        };

        if (addToList) {
            keyboardLayouts = keyboardLayouts.filter((layout) => layout.path != path);

            keyboardLayouts.push(keyboard);

            if (currentKeyboardLayout == null) {
                currentKeyboardLayout = keyboard;

                render();
            }
        }

        return Promise.resolve(keyboard);
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

export function loadInputDataFromConfig() {
    return config.read("input.gsc").then(function(data) {
        var defaultPath;

        data.keyboardLayouts ||= [];

        if (data.keyboardLayouts.length == 0) {
            return fetch("gshell://input/l10nmappings.json").then(function(response) {
                return response.json();
            }).then(function(mappingsData) {
                defaultPath = (mappingsData.mappings[l10n.currentLocale.localeCode] || mappingsData.mappings["en_GB"])[0]

                return fetch(defaultPath);
            }).then(function(response) {
                return response.json();
            }).then(function(defaultLayout) {
                return defaultLayout.inputMethodPaths;
            }).then(function(defaultInputMethodPaths) {
                data.keyboardLayouts.push({
                    path: defaultPath,
                    inputMethodPaths: defaultInputMethodPaths.slice(0, 1)
                });

                data.isGenerated = true;

                return Promise.resolve(data);
            });
        }

        return Promise.resolve(data);
    });
}

export function saveInputDataToConfig(data) {
    return config.edit("input.gsc", function(currentData) {
        return Promise.resolve(data);
    }).then(function() {
        webviewComms.update();
        loadKeyboardLayoutsFromConfig();

        return Promise.resolve();
    });
}

export function saveKeyboardLayoutsToConfig(layouts = keyboardLayouts) {
    return config.edit("input.gsc", function(data) {
        data.keyboardLayouts = layouts.map((layout) => ({
            path: layout.path,
            inputMethodPaths: layout.inputMethodPaths
        }));

        data.isGenerated = false;

        return Promise.resolve(data);
    }).then(function() {
        webviewComms.update();
        loadKeyboardLayoutsFromConfig();

        return Promise.resolve();
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

export function getAllKeyboardLayoutOptions(serialise = false) {
    return fetch("gshell://input/l10nmappings.json").then(function(response) {
        return response.json();
    }).then(function(data) {
        return Promise.all(Object.keys(data.mappings).map(function(localeCode) {
            return Promise.all(data.mappings[localeCode].map(function(layoutPath) {
                var layout;

                return loadKeyboardLayout(layoutPath, null, false).then(function(loadedLayout) {
                    layout = loadedLayout;

                    return layout.loadAllInputMethods();
                }).then(function() {
                    return Promise.resolve(layout.serialiseForOptionSelection());
                });
            })).then(function(layouts) {
                return {
                    localeCode,
                    name: data.languageNames[localeCode],
                    layouts
                };
            });
        }));
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
    return element.is(INPUT_SELECTOR) && !(NON_TEXTUAL_INPUTS.includes(String(element.getAttribute("type") || "").toLowerCase()));
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
    targetInputSurface = document.activeElement;

    showing = true;
    showingMode = mode;
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
        $g.sel(".input").setStyle("top", "unset");
        $g.sel(".input").setStyle("left", "unset");

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
    if (!force && (!showing || showingTransition)) {
        return;
    }

    aui_a11y.clearFocusTrap();

    showing = false;
    showingMode = inputModes.NONE;

    targetInput?.focus();

    if (targetInput?.matches("input")) {
        targetInput.scrollLeft = 0;
    }

    targetInput = null;
    inputEntryBuffer = [];

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