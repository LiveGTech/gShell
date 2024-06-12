/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export var trackedMonitors = [];
export var outputStatesChanged = false;

export class Monitor {
    constructor(id) {
        var thisScope = this;

        this.id = id;
        this.inputState = {};
        this.outputState = null;
        this.config = null;
        this.updateCallbacks = [];

        this.onUpdate(function() {
            if (thisScope.inputState.isConnected && !thisScope.inputState.isConfigured) {
                this.applyOutputState(true);
            }

            if (thisScope.inputState.isConfigured && !thisScope.inputState.isConnected) {
                this.applyOutputState(false);
            }
        });
    }

    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    applyConfigDefaults() {
        if (this.config != null) {
            return;
        }

        if (!this.inputState.isConfigured || this.inputState.modes.length == 0) {
            throw new Error("Cannot generate default config for monitor that is not connected");
        }

        var primaryConnectedMonitor = getPrimaryConnectedMonitor();

        this.config = {
            isPrimary: primaryConnectedMonitor == this,
            modeId: (this.inputState.modes.find((mode) => mode.isPreferred) || this.inputState.modes[0]).id,
            ...(primaryConnectedMonitor == this ? {
                view: "extend",
                x: 0,
                y: 0
            } : {
                view: "mirror",
                mirrorTarget: primaryConnectedMonitor
            })
        };
    }

    getMode(modeId = this.config.modeId) {
        return this.inputState.modes.find((mode) => mode.id == modeId);
    }

    applyOutputState(enabled = this.inputState.isConnected) {
        this.outputState = {
            id: this.id,
            isEnabled: enabled
        };

        outputStatesChanged = true;

        if (!enabled) {
            return;
        }

        this.applyConfigDefaults();

        this.outputState.modeId = this.config.modeId;
        this.outputState.isPrimary = this.config.isPrimary;

        if (this.config.view == "mirror") {
            var mirrorTarget = this.config.mirrorTarget;

            if (!mirrorTarget.inputState.isConnected) {
                mirrorTarget = getPrimaryConnectedMonitor();
            }

            mirrorTarget.applyConfigDefaults();

            if (mirrorTarget == this || mirrorTarget.config.view == "mirror") {
                this.config.view = "extend";
            } else {
                this.outputState.x = mirrorTarget.outputState.x;
                this.outputState.y = mirrorTarget.outputState.y;

                var ownMode = this.getMode();
                var ownAspectRatio = ownMode.width / ownMode.height;
                var targetMode = mirrorTarget.getMode();
                var targetAspectRatio = targetMode.width / targetMode.height;

                var isHorizontalLetterboxing = targetAspectRatio > ownAspectRatio;
                var scale = isHorizontalLetterboxing ? (targetMode.width / ownMode.width) : (targetMode.height / ownMode.height);
                var xOffset = !isHorizontalLetterboxing ? ((ownMode.width - (targetMode.width / scale)) / 2) : 0;
                var yOffset = isHorizontalLetterboxing ? ((ownMode.height - (targetMode.height / scale)) / 2) : 0;

                this.outputState.transformationMatrix = [
                    scale, 0, -xOffset,
                    0, scale, -yOffset,
                    0, 0, 1
                ];
            }
        }
        
        if (this.config.view == "extend") {
            this.outputState.x = this.config.x || 0;
            this.outputState.y = this.config.y || 0;
        }
    }
}

export function getConnectedMonitors() {
    return trackedMonitors.filter((monitor) => monitor.inputState.isConnected);
}

export function getPrimaryConnectedMonitor() {
    var connectedMonitors = getConnectedMonitors();

    return connectedMonitors.find((monitor) => monitor.inputState.isPrimary) || connectedMonitors[0] || null;
}

export function update() {
    return gShell.call("io_getMonitors").then(function(data) {
        trackedMonitors = trackedMonitors.filter((monitor) => data.monitors.find((monitorData) => monitorData.id == monitor.id));

        data.monitors.forEach(function(monitorData) {
            var monitor = trackedMonitors.find((monitor) => monitorData.id == monitor.id);

            if (monitor == null) {
                monitor = new Monitor(monitorData.id);

                trackedMonitors.push(monitor);
            }

            monitor.inputState = monitorData;

            monitor.updateCallbacks.forEach((callback) => callback());
        });
    });
}

export function apply(forceSetOutputStates) {
    if (forceSetOutputStates) {
        trackedMonitors.forEach((monitor) => monitor.applyOutputState());
    }

    outputStatesChanged = false;

    var outputStates = trackedMonitors.map((monitor) => monitor.outputState).filter((outputState) => outputState != null);

    if (outputStates.length == 0) {
        return Promise.resolve();
    }

    return gShell.call("io_setMonitors", {
        monitors: trackedMonitors.map((monitor) => monitor.outputState).filter((outputState) => outputState != null)
    });
}