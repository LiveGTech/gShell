/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";
import * as l10n from "gshell://config/l10n.js";
import * as webviewComms from "gshell://userenv/webviewcomms.js";

export const NAME = "readout";

const VALID_ARIA_ROLES = ["article", "button", "cell", "checkbox", "columnheader", "dialog", "document", "expandable", "figure", "form", "heading", "img", "input", "link", "list", "listbox", "listitem", "main", "mark", "marquee", "math", "navigation", "progressbar", "radio", "row", "searchbox", "section", "slider", "switch", "table", "textbox", "textarea", "urlinput"];

const ROLES_TO_EARCONS = {
    "button": "button",
    "checkbox": "switch-off",
    "input": "input",
    "listbox": "select",
    "radio": "switch-off",
    "searchbox": "input",
    "switch": "switch-off",
    "textbox": "input",
    "textarea": "input",
    "urlinput": "input"
};

var keyDescriptions = null;

export class ReadoutNavigation extends a11y.AssistiveTechnology {
    lastUsedVoice = null;
    lastLocaleCode = null;
    currentAnnouncementId = 0;
    modifierKeyDown = false;

    init() {
        var thisScope = this;
        var readoutWasEnabled = false;

        setInterval(function() {
            if (!a11y.options.readout_enabled) {
                if (readoutWasEnabled) {
                    $g.sel(".a11y_panel.readout").fadeOut();

                    thisScope.announce({
                        type: "message",
                        earcon: "off",
                        message: "off"
                    }, true);
                }

                readoutWasEnabled = false;

                return;
            }

            if (!readoutWasEnabled) {
                $g.sel(".a11y_panel.readout").fadeIn();

                thisScope.announce({
                    type: "message",
                    earcon: "on",
                    message: "on"
                });
            }

            readoutWasEnabled = true;
        });

        function keyupCallback(event) {
            if (event.code == "CapsLock") {
                thisScope.modifierKeyDown = false;
            }
        }

        function keydownCallback(event) {
            if (!a11y.options.readout_enabled) {
                return;
            }

            if (event.code == "CapsLock") {
                thisScope.modifierKeyDown = true;
            }

            if (thisScope.modifierKeyDown && event.key == "Escape") {
                $g.sel(".switcher_home").focus();

                setTimeout(function() {
                    thisScope.announce({
                        type: "message",
                        message: "exitContext"
                    });
                });
            }
        }

        $g.sel("body").on("keyup", keyupCallback);
        webviewComms.onEvent("keyup", keyupCallback);

        $g.sel("body").on("keydown", keydownCallback);
        webviewComms.onEvent("keydown", keydownCallback);
    }

    update() {
        gShell.call("io_setCapsLockEnabled", {enabled: !a11y.options.readout_enabled});
    }

    getSuitableVoice() {
        if (this.lastLocaleCode == l10n.currentLocale.localeCode) {
            return this.lastUsedVoice;
        }

        var voices = speechSynthesis.getVoices();
        var currentLocaleCode = l10n.currentLocale.localeCode;
        var selectedVoice = null;

        voices.forEach(function(voice) {
            if (selectedVoice != null) {
                return;
            }

            if (voice.lang.replace(/-/g, "_") == currentLocaleCode) {
                selectedVoice = voice;
            }
        });

        if (selectedVoice == null) {
            voices.forEach(function(voice) {
                if (selectedVoice != null) {
                    return;
                }

                if (voice.lang.split("-")[0] == currentLocaleCode.split("_")[0]) {
                    selectedVoice = voice;
                }
            });
        }

        if (selectedVoice == null) {
            throw new Error("No suitable voice for current locale found");
        }

        this.lastUsedVoice = selectedVoice;
        this.lastLocaleCode = currentLocaleCode;

        return selectedVoice;
    }

    speak(message, pitch = 1) {
        var thisScope = this;

        if (message.trim() == "") {
            return Promise.resolve();
        }

        message = message.replace(/\bliveg\b/gi, "livh-g");
        message = message.replace(/\blivesey\b/gi, "livh-see");

        return new Promise(function(resolve, reject) {
            speechSynthesis.cancel();

            var utterance = new SpeechSynthesisUtterance(message);

            utterance.voice = thisScope.getSuitableVoice();
            utterance.pitch = pitch;

            utterance.addEventListener("end", function() {
                resolve();
            });

            speechSynthesis.speak(utterance);
        });
    }

    playEarcon(earcon) {
        var audio = new Audio(`gshell://media/readout-earcons/${earcon}.wav`);

        return new Promise(function(resolve, reject) {
            audio.addEventListener("ended", function() {
                resolve();
            });

            audio.play();
        });
    }

    announceViaPanel(data, announcementId) {
        var announcementElement = $g.sel(".a11y_readout_announcement");

        function addSeparator() {
            if (announcementElement.getText() == "") {
                return;
            }

            announcementElement.add(
                $g.create("span").setText(" · ")
            );
        }

        announcementElement.clear();

        if (data.message) {
            addSeparator();

            announcementElement.add(
                $g.create("span").setText(_(`a11y_readout_message_${data.message}`))
            );
        }

        if (data.description) {
            addSeparator();

            announcementElement.add(
                $g.create("span").setText(data.description)
            );
        }

        if (data.role && VALID_ARIA_ROLES.includes(data.role)) {
            addSeparator();

            announcementElement.add(
                $g.create("strong").setText(_(`a11y_readout_role_${data.role}`))
            );
        }

        if (data.state) {
            addSeparator();

            announcementElement.add(
                $g.create("span").setText(_(`a11y_readout_state_${data.state}`))
            );
        }

        if (data.label) {
            addSeparator();

            announcementElement.add(
                $g.create("em").setText(data.label)
            )
        }

        if (data.hint) {
            addSeparator();

            announcementElement.add(
                $g.create("em").setText(_(`a11y_readout_hint_${data.hint}`))
            );
        }
    }

    async announceViaVoice(data, announcementId) {
        var thisScope = this;

        function interruptable(callback, ...args) {
            if (thisScope.currentAnnouncementId != announcementId) {
                return Promise.resolve();
            }

            return callback.apply(thisScope, args);
        }

        function pauseForDuration(milliseconds) {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                }, milliseconds);
            });
        }

        speechSynthesis.cancel();

        if (data.earcon) {
            await interruptable(this.playEarcon, data.earcon);
        } if (data.role in ROLES_TO_EARCONS) {
            switch (data.role) {
                case "checkbox":
                case "radio":
                case "switch":
                    await interruptable(this.playEarcon, ["on", "indeterminate"].includes(data.state) ? "switch-on" : "switch-off");
                    break;

                default:
                    await interruptable(this.playEarcon, ROLES_TO_EARCONS[data.role]);
                    break;
            }
        }

        if (data.keyPress) {
            var descriptions = await getKeyDescriptions();

            await interruptable(this.speak, descriptions[l10n.currentLocale.localeCode]?.[data.keyPress] ?? data.keyPress);
        }

        if (data.textInsert) {
            await interruptable(this.speak, data.textInsert);
        }

        if (data.textDelete) {
            await interruptable(this.speak, data.textDelete, 0.5);
        }

        if (data.message) {
            await interruptable(this.speak, _(`a11y_readout_message_${data.message}`));
        }

        if (data.description) {
            await interruptable(this.speak, data.description);
        }

        if (data.role && VALID_ARIA_ROLES.includes(data.role)) {
            await interruptable(this.speak, _(`a11y_readout_role_${data.role}`));
        }

        if (data.state) {
            await interruptable(this.speak, _(`a11y_readout_state_${data.state}`));
        }

        if (data.label) {
            await interruptable(this.speak, data.label, 0);
        }

        if (data.hint) {
            await interruptable(pauseForDuration, 1_000);
            await interruptable(this.speak, _(`a11y_readout_hint_${data.hint}`), 0.5);
        }
    }

    announce(data, force = false) {
        if (!a11y.options.readout_enabled && !force) {
            return;
        }

        this.currentAnnouncementId++;

        console.log("Readout Navigation announcement received:", data);

        if (!data.voiceOnly) {
            this.announceViaPanel(data, this.currentAnnouncementId);
        }

        this.announceViaVoice(data, this.currentAnnouncementId);
    }
}

function getKeyDescriptions() {
    if (keyDescriptions) {
        return Promise.resolve(keyDescriptions);
    }

    return fetch("gshell://a11y/l10nkeys.json").then(function(response) {
        return response.json();
    }).then(function(data) {
        keyDescriptions = data;

        return Promise.resolve(keyDescriptions);
    });
}

a11y.registerAssistiveTechnology(ReadoutNavigation);