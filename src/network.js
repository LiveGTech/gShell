/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const electron = require("electron");
const electronFetch = require("electron-fetch").default;
const electronDl = require("electron-dl");

var main = require("./main");
var flags = require("./flags");
var storage = require("./storage");
var config = require("./config");
var system = require("./system");

var downloadFileProcesses = [];
var downloadFileItems = [];

function ssidToQualifiedName(ssid) {
    return `wifi/${ssid}`;
}

function qualifiedNameToSsid(name) {
    return name.replace(/^wifi\//, "");
}

exports.parseNmcliLine = function(line) {
    var data = [];
    var field = "";
    var escaping = false;

    for (var i = 0; i < line.length; i++) {
        if (escaping) {
            field += line[i];
            escaping = false;

            continue;
        }

        switch (line[i]) {
            case "\\":
                escaping = true;
                break;

            case ":":
                data.push(field);

                field = "";

                break;

            default:
                field += line[i];
                break;
        }
    }

    data.push(field);

    return data;
};

exports.list = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve([]);
    }

    return system.executeCommand("nmcli", ["--terse", "--escape", "yes", "--colors", "no", "--get-values", "name,type,active", "connection"]).then(function(output) {
        var lines = output.stdout.split("\n").filter((line) => line != "");

        return lines.map(function(line) {
            var data = exports.parseNmcliLine(line);

            return {
                name: qualifiedNameToSsid(data[0]),
                qualifiedName: data[0],
                type: {
                    "802-11-wireless": "wifi",
                    "802-3-ethernet": "ethernet",
                    "loopback": "loopback"
                }[data[1]] || "unknown",
                connected: data[2] == "yes"
            };
        });
    });
};

exports.scanWifi = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve([]);
    }

    return system.executeCommand("nmcli", ["device", "wifi", "rescan"]).then(function() {
        return system.executeCommand("nmcli", ["--terse", "--escape", "yes", "--colors", "no", "--get-values", "ssid,bssid,chan,rate,signal,security,active", "device", "wifi", "list"]);
    }).then(function(output) {
        var lines = output.stdout.split("\n").filter((line) => line != "");

        return lines.map(function(line) {
            var data = exports.parseNmcliLine(line);

            return {
                name: data[0],
                bssid: data[1],
                channel: parseInt(data[2]),
                bandwidth: parseInt(data[3]),
                signal: parseInt(data[4]),
                security: data[5].split(" ").filter((data) => data != "").map((data) => ({
                    "WEP": "wep",
                    "WPA1": "wpa1",
                    "WPA2": "wpa2",
                    "802.1X": "802_1x"
                }[data] || "unknown")),
                connected: data[6] == "yes"
            };
        });
    });
};

exports.disconnectWifi = function(name) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.list().then(function(results) {
        var matchingResults = results.filter((result) => result.qualifiedName == ssidToQualifiedName(name) && result.connected);

        if (matchingResults.length == 0) {
            return Promise.resolve();
        }

        return system.executeCommand("nmcli", ["connection", "down", ssidToQualifiedName(name)]);
    });
};

exports.forgetWifi = function(name) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.list().then(function(results) {
        var matchingResults = results.filter((result) => result.qualifiedName == ssidToQualifiedName(name));

        if (matchingResults.length == 0) {
            return Promise.resolve();
        }

        return system.executeCommand("nmcli", ["connection", "delete", ssidToQualifiedName(name)]); // This should also disconnect if already connected
    });
};

exports.configureWifi = function(name, auth = {}) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.forgetWifi(name).then(function() {
        return system.executeCommand("nmcli", ["connection", "add", "type", "wifi", "connection.id", ssidToQualifiedName(name), "ssid", name, ...Object.entries(auth).flat()]);
    });
};

exports.connectWifi = function(name) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.disconnectWifi().then(function() {
        return system.executeCommand("nmcli", ["device", "wifi", "connect", name], null);
    }).then(function(data) {
        if (data.stdout.includes("Error:")) {
            if (data.stdout.includes("(7)")) {
                return Promise.resolve("invalidAuth");
            }

            return Promise.reject("Could not connect to Wi-Fi network");
        }

        return Promise.resolve("connected");
    });
};

exports.getProxy = function() {
    return config.read("proxy.gsc");
};

function setProxyForAllSessions(data) {
    return Promise.all([
        electron.session.defaultSession,
        ...electron.webContents.getAllWebContents().map((webContents) => webContents.session)
    ].map(function(session) {
        return session.setProxy(data);
    }));
}

exports.updateProxy = function() {
    return exports.getProxy().then(function(data) {
        var excludeMatches = (data.excludeMatches || [])
            .filter((match) => match.trim() != "")
            .join(",")
        ;

        // TODO: Investigate to what modes `excludeMatches` applies

        switch (data?.mode) {
            case "autoDetect":
                return setProxyForAllSessions({
                    mode: "auto_detect"
                });

            case "pacScriptUrl":
                return setProxyForAllSessions({
                    mode: "pac_script",
                    pacScript: data.pacScriptUrl
                });

            case "socks":
                return setProxyForAllSessions({
                    mode: "fixed_servers",
                    proxyRules: data.socksProxy
                });

            case "http":
                var proxyRules = data.httpProxy;

                if (data.httpsProxy && data.httpsProxy.trim() != "") {
                    proxyRules = `http=${data.httpProxy};https=${data.httpsProxy}`;
                }

                return setProxyForAllSessions({
                    mode: "fixed_servers",
                    proxyRules,
                    proxyBypassRules: excludeMatches
                });

            default:
                return setProxyForAllSessions({mode: "direct"});
        }
    });
};

exports.setProxy = function(data) {
    return config.write("proxy.gsc", data).then(function() {
        return exports.updateProxy();
    });
};

exports.getContentLength = function(url) {
    return electronFetch(url, {method: "HEAD", cache: "no-store"}).then(function(response) {
        return Promise.resolve(Number(response.headers.get("Content-Length")));
    });
};

exports.downloadFile = function(url, destination, getProcessId = false) {
    var path = storage.getPath(destination).split("/");
    var filename = path.pop();
    var folder = path.join("/");

    var id = downloadFileProcesses.length;
    var abortControllerId = system.createAbortControllerId();

    downloadFileProcesses.push({
        status: "running",
        downloadedBytes: null,
        totalBytes: null,
        progress: 0,
        abortControllerId
    });

    downloadFileItems.push(null);

    var promise = exports.getContentLength(url).then(function(downloadSize) {
        return electronDl.download(main.window, url, {
            filename,
            directory: folder,
            onStarted: function(item) {
                if (downloadFileProcesses[id].status == "cancelled") {
                    item.cancel();
                }

                downloadFileItems[id] = item;
            },
            onProgress: function(data) {
                var total = data.totalBytes || downloadSize;

                downloadFileProcesses[id].downloadedBytes = data.transferredBytes;
                downloadFileProcesses[id].totalBytes = total;
                downloadFileProcesses[id].progress = total > 0 ? (data.transferredBytes / total) : 0;
            }
        })
    }).then(function() {
        downloadFileProcesses[id].status = "success";

        return Promise.resolve();
    }).catch(function(error) {
        console.error(error);

        downloadFileProcesses[id].status = "error";

        return Promise.reject(error);
    });

    system.abortControllers[abortControllerId].signal.onabort = function() {
        exports.cancelFileDownload(id);
    };

    if (getProcessId) {
        return Promise.resolve(id);
    }

    return promise;
};

exports.getDownloadFileInfo = function(id) {
    if (id >= downloadFileProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    return Promise.resolve(downloadFileProcesses[id]);
};

exports.pauseFileDownload = function(id) {
    if (id >= downloadFileProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    if (downloadFileProcesses[id].status != "running") {
        return Promise.reject("File download cannot be paused as it is not running");
    }

    downloadFileProcesses[id].status = "paused";

    downloadFileItems[id]?.pause();
};

exports.resumeFileDownload = function(id) {
    if (id >= downloadFileProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    if (downloadFileProcesses[id].status != "paused") {
        return Promise.reject("File download cannot be resumed as it is not paused");
    }

    downloadFileProcesses[id].status = "running";

    downloadFileItems[id]?.resume();
};

exports.cancelFileDownload = function(id) {
    if (id >= downloadFileProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    if (["success", "error"].includes(downloadFileProcesses[id].status)) {
        return Promise.reject("File download cannot be cancelled as it is not in progress");
    }

    downloadFileProcesses[id].status = "cancelled";

    downloadFileItems[id]?.cancel();
};