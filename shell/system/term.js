/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var allTerminals = [];

export class Terminal {
    constructor(file = "bash", args = [], options = {}) {
        this.file = file;
        this.args = args;
        this.options = options;

        this._running = false;
        this._id = null;
        this._readCallbacks = [];
        this._exitCallbacks = [];

        allTerminals.push(this);
    }

    get id() {
        return this._id;
    }

    get running() {
        return this._running;
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
        this._exitCallbacks.push(callback);
    }

    write(data) {
        if (!this._running) {
            return Promise.reject("Terminal process is not running");
        }

        return gShell.call("term_write", {id: this._id, data});
    }
}

export function getTerminalById(id) {
    return allTerminals.find((terminal) => terminal.running && terminal.id == id);
}

gShell.on("term_read", function(event, data) {
    getTerminalById(data.id)?._readCallbacks.forEach(function(callback) {
        callback(data.data);
    });
});

gShell.on("term_exit", function(event, data) {
    getTerminalById(data.id)?._readCallbacks.forEach(function(callback) {
        callback(data.exitCode, data.signal);
    });
});