/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/


import * as displays from "gshell://system/displays.js";

export var workArea = null;
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
                thisScope.applyOutputState(true);
                apply();
            }

            if (thisScope.inputState.isConfigured && !thisScope.inputState.isConnected) {
                thisScope.applyOutputState(false);
                apply();
            }
        });
    }

    get x() {
        return this.outputState.x;
    }

    get y() {
        return this.outputState.y;
    }

    get width() {
        return this.getMode().width;
    }

    get height() {
        return this.getMode().height;
    }

    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    applyConfigDefaults() {
        if (this.config != null) {
            return;
        }

        if (!this.inputState.isConnected || this.inputState.modes.length == 0) {
            throw new Error("Cannot generate default config for monitor that is not connected");
        }

        var primaryConnectedMonitor = getPrimaryConnectedMonitor();

        this.config = {
            isPrimary: primaryConnectedMonitor == this,
            modeId: (this.inputState.modes.find((mode) => mode.isActive) || this.inputState.modes[0]).id,
            ...(primaryConnectedMonitor == this ? {
                view: "extend",
                x: 0,
                y: 0
            } : (["monitor", "internalDisplay"].includes(this.inputState.type) ? {
                view: "extend",
                ...findNextSuitableExtendedMonitorPosition()
            } : {
                view: "mirror",
                mirrorTarget: primaryConnectedMonitor
            }))
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

            if (this == getPrimaryConnectedMonitor() || mirrorTarget == this || mirrorTarget.config.view == "mirror") {
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

            delete this.outputState.transformationMatrix;
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

export function findNextSuitableExtendedMonitorPosition() {
    var x = 0;
    var y = 0;

    trackedMonitors.forEach(function(monitor) {
        if (monitor.config == null) {
            return;
        }

        if (monitor.x + monitor.width > x) {
            x = monitor.x + monitor.width;
            y = monitor.y;
        }
    });

    return {x, y};
}

export function update() {
    return gShell.call("io_getMonitors").then(function(data) {
        workArea = data.workArea;

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

        trackedMonitors.forEach(function(monitor) {
            if (monitor.outputState == null) {
                monitor.applyOutputState();
            }
        });

        displays.applyMonitorsToDisplays();

        return Promise.resolve();
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

export function init() {
    $g.sel("#monitors_curtain").hide();

    function delay(duration) {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve();
            }, duration);
        });
    }

    return update().then(function() {
        gShell.on("xorg_monitorChange", function() {
            $g.sel("#monitors_curtain").fadeIn(250).then(function() {
                return delay(1_000);
            }).then(function() {
                return update();   
            }).then(function() {
                return delay(1_000);
            }).then(function() {
                $g.sel("#monitors_curtain").fadeOut(250);
            });
        });

        return Promise.resolve();
    });
}