/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as webviewComms from "gshell://userenv/webviewcomms.js";
import * as system from "gshell://system/system.js";
import * as network from "gshell://system/network.js";
import * as l10n from "gshell://config/l10n.js";
import * as updates from "gshell://system/updates.js";
import * as interaction from "gshell://system/interaction.js";
import * as term from "gshell://system/term.js";
import * as input from "gshell://input/input.js";
import * as personalisation from "gshell://config/personalisation.js";
import * as a11y from "gshell://a11y/a11y.js";

export var data = {};

export var commands = {
    system_shutDown: (data) => system.shutDown(data.reason),
    system_restart: (data) => system.restart(data.reason),
    network_getList: network.getList,
    network_scanWifi: network.scanWifi,
    network_disconnectWifi: (data) => network.disconnectWifi(data.name),
    network_forgetWifi: (data) => network.forgetWifi(data.name),
    network_configureWifi: (data) => network.configureWifi(data.name, data.auth),
    network_connectWifi: (data) => network.connectWifi(data.name),
    network_getProxy: network.getProxy,
    network_setProxy: network.setProxy,
    l10n_setLocale: (data) => l10n.setLocale(data.localeCode),
    input_loadInputDataFromConfig: input.loadInputDataFromConfig,
    input_saveInputDataToConfig: (data) => input.saveInputDataToConfig(data.data),
    input_loadKeyboardLayoutsFromConfig: input.loadKeyboardLayoutsFromConfig,
    input_saveKeyboardLayoutsToConfig: (data) => input.saveKeyboardLayoutsToConfig(data.layouts),
    input_getAllKeyboardLayoutOptions: () => input.getAllKeyboardLayoutOptions(true),
    personalisation_setOption: (data) => personalisation.setOption(data.name, data.value, data.global),
    a11y_setOption: (data) => a11y.setOption(data.name, data.value),
    updates_getUpdates: updates.getUpdates,
    updates_startUpdate: (data) => updates.startUpdate(data.update),
    updates_cancelUpdate: updates.cancelUpdate,
    updates_setUpdateCircuit: (data) => updates.setUpdateCircuit(data.circuit),
    updates_setShouldAutoCheckForUpdates: (data) => updates.setShouldAutoCheckForUpdates(data.value),
    updates_setShouldAutoRestart: (data) => updates.setShouldAutoRestart(data.value),
    interaction_setOption: (data) => interaction.setOption(data.name, data.value),
    term_create: (data, metadata) => term.createForPrivilegedInterface(metadata, data.file, data.args, data.options),
    term_isRunning: (data) => Promise.resolve(term.getTerminalByKey(data.key).isRunning),
    term_spawn: (data) => term.getTerminalByKey(data.key).spawn(),
    term_kill: (data) => term.getTerminalByKey(data.key).kill(data.signal),
    term_write: (data) => term.getTerminalByKey(data.key).write(data.data),
    term_setSize: (data) => term.getTerminalByKey(data.key).setSize(data.columns, data.rows)
};

export function setData(name, dataValue) {
    data[name] = dataValue;

    webviewComms.update();
};