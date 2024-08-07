/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as info from "gshell://global/info.js";

export const MODEM_CHECK_INTERVAL = 5 * 1_000; // 5 seconds

export var modems = [];

export class Modem {
    constructor(id) {
        var thisScope = this;

        this.id = id;

        this.available = true;
        this.info = null;
        this.signalInfo = null;

        this.signalPollInterval = setInterval(function() {
            thisScope.updateSignalInfo();
        }, MODEM_CHECK_INTERVAL);
    }

    get enabled() {
        return this.available && !!this.info?.enabled;
    }

    enable() {
        var thisScope = this;

        return gShell.call("mobile_setModemActiveState", {modemId: this.id, enable: true}).then(function() {
            return gShell.call("mobile_setSignalPollInterval", {modemId: thisScope.id, interval: MODEM_CHECK_INTERVAL});
        }).then(function() {
            return thisScope.updateSignalInfo();
        });
    }

    disable() {
        this.signalInfo = null;

        return gShell.call("mobile_setModemActiveState", {modemId: this.id, enable: false});
    }

    makeUnavailable() {
        this.available = false;

        clearInterval(this.signalPollInterval);
    }

    updateSignalInfo() {
        var thisScope = this;

        if (!this.enabled) {
            return Promise.resolve();
        }

        return gShell.call("mobile_getSignalInfo", {modemId: this.id}).then(function(data) {
            thisScope.signalInfo = data;

            info.applyMobile();

            return Promise.resolve();
        });
    }
};

export function getModems() {
    return gShell.call("mobile_listModems").then(function(data) {
        var modemsNotListed = [...modems];

        Object.keys(data).forEach(function(modemId) {
            var foundModem = modems.find((modem) => modem.id == modemId);

            if (foundModem) {
                modemsNotListed = modemsNotListed.filter((modem) => modem != foundModem);

                foundModem.info = data[modemId];
            } else {
                var modem = new Modem(modemId);

                modem.info = data[modemId];

                modems.push(modem);

                modem.enable();
            }
        });

        modemsNotListed.forEach((modem) => modem.makeUnavailable());

        modems = modems.filter((modem) => !modemsNotListed.includes(modem));

        info.applyMobile();

        return Promise.resolve(modems);
    });
}

export function hasSignal() {
    var primaryModem = modems.find((modem) => modem.enabled && modem.signalInfo != null);

    if (!primaryModem) {
        return false;
    }

    return primaryModem.signalInfo.bestAvailableTechnology != null;
}

export function init() {
    getModems();

    setInterval(function() {
        getModems();
    }, MODEM_CHECK_INTERVAL);
}