/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

var allTerminals = [];

export class Terminal {
    constructor(file = "bash", args = [], options = {}) {
        this.file = file;
        this.args = args;
        this.options = options;

        this._running = false;
        this._id = null;
        this._key = $g.core.generateKey(64);
        this._readCallbacks = [];
        this._exitCallbacks = [];

        allTerminals.push(this);
    }

    get running() {
        return this._running;
    }

    get id() {
        return this._id;
    }

    get key() {
        return this._key;
    }

    spawn() {
        var thisScope = this;

        return gShell.call("term_spawn", {
            file: this.file,
            args: this.args,
            options: this.options
        }).then(function(id) {
            thisScope._running = true;
            thisScope._id = id;
        });
    }

    onRead(callback) {
        this._readCallbacks.push(callback);
    }

    onExit(callback) {
        this._running = false;

        this._exitCallbacks.push(callback);
    }

    kill(signal = 9) {
        var thisScope = this;

        return gShell.call("term_kill", {id: this._id, signal}).then(function() {
            thisScope._running = false;

            return Promise.resolve();
        });
    }

    write(data) {
        if (!this._running) {
            return Promise.reject("Terminal process is not running");
        }

        return gShell.call("term_write", {id: this._id, data});
    }

    setSize(columns, rows) {
        if (!this._running) {
            return Promise.reject("Terminal process is not running");
        }

        return gShell.call("term_setSize", {id: this._id, columns, rows});
    }
}

export function getTerminalById(id) {
    return allTerminals.find((terminal) => terminal.running && terminal.id == id);
}

export function getTerminalByKey(key) {
    return allTerminals.find((terminal) => terminal.key == key);
}

export function createForPrivilegedInterface(metadata, file, args, options) {
    return gShell.call("system_getFlags").then(function(flags) {
        if (!flags.isRealHardware && options.env) {
            delete options.env;
        }

        if (metadata.user != null) {
            if (flags.isRealHardware) {
                options.env ||= {};
                options.env["XAUTHORITY"] ||= `/home/${metadata.user.linuxUsername}/.Xauthority`;
            }

            var newArgs;
            var envArgs = [];

            Object.keys(options.env || {}).forEach(function(key) {
                envArgs.push(`${key}=${options.env[key]}`);
            });

            if (file != null) {
                newArgs = ["-u", metadata.user.linuxUsername, ...envArgs, file, ...args];
            } else {
                newArgs = ["-i", "-u", metadata.user.linuxUsername, ...envArgs];
            }

            if (flags.isRealHardware) {
                file = "sudo";
                args = newArgs;
            } else {
                console.log(`Would run if on real hardware: sudo ${newArgs.join(" ")}`);
            }
        }

        var terminal = new Terminal(file || "bash", args, options);

        terminal.onRead(function(data) {
            metadata.webview.get().send("term_read", {key: terminal.key, data});
        });

        terminal.onExit(function(exitCode, signal) {
            metadata.webview.get().send("term_exit", {key: terminal.key, exitCode, signal});
        });

        metadata.webview.on("switcherclose", function() {
            terminal.kill("SIGHUP");
        });

        return Promise.resolve(terminal.key);
    });
}

gShell.on("term_read", function(event, data) {
    getTerminalById(data.id)?._readCallbacks.forEach(function(callback) {
        callback(data.data);
    });
});

gShell.on("term_exit", function(event, data) {
    getTerminalById(data.id)?._exitCallbacks.forEach(function(callback) {
        callback(data.exitCode, data.signal);
    });
});