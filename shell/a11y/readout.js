/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as a11y from "gshell://a11y/a11y.js";
import * as l10n from "gshell://config/l10n.js";

export const NAME = "readout";

const VALID_ARIA_ROLES = ["article", "button", "cell", "checkbox", "columnheader", "dialog", "document", "expandable", "figure", "form", "heading", "img", "input", "link", "list", "listbox", "listitem", "main", "mark", "marquee", "math", "navigation", "progressbar", "radio", "row", "searchbox", "section", "slider", "switch", "table", "textbox", "textarea", "urlinput"];

export class ReadoutNavigation extends a11y.AssistiveTechnology {
    lastUsedVoice = null;
    lastLocaleCode = null;
    currentAnnouncementId = 0;

    init() {
        console.log("Readout Navigation loaded");

        var readoutWasEnabled = false;

        setInterval(function() {
            if (!a11y.options.readout_enabled) {
                if (readoutWasEnabled) {
                    $g.sel(".a11y_panel.readout").fadeOut();
                }

                readoutWasEnabled = false;

                return;
            }

            if (!readoutWasEnabled) {
                $g.sel(".a11y_panel.readout").fadeIn();
            }

            readoutWasEnabled = true;
        });
    }

    update() {
        console.log("Readout Navigation state updated:", a11y.options.readout_enabled);
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

        if (data.label) {
            addSeparator();

            announcementElement.add(
                $g.create("em").setText(data.label)
            )
        }
    }

    async announceViaVoice(data, announcementId) {
        var thisScope = this;

        function interruptable(callback, ...args) {
            console.log(args);
            if (thisScope.currentAnnouncementId != announcementId) {
                return Promise.resolve();
            }

            return callback.apply(thisScope, args);
        }

        if (data.description) {
            await interruptable(this.speak, data.description);
        }

        if (data.role && VALID_ARIA_ROLES.includes(data.role)) {
            await interruptable(this.speak, _(`a11y_readout_role_${data.role}`));
        }

        if (data.label) {
            await interruptable(this.speak, data.label, 0);
        }
    }

    announce(data) {
        if (!a11y.options.readout_enabled) {
            return;
        }

        this.currentAnnouncementId++;

        console.log("Readout Navigation announcement received:", data);

        this.announceViaPanel(data, this.currentAnnouncementId);
        this.announceViaVoice(data, this.currentAnnouncementId);
    }
}

a11y.registerAssistiveTechnology(ReadoutNavigation);