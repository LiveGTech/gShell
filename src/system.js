/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const child_process = require("child_process");
const stream = require("stream");
const fs = require("fs");
const electron = require("electron");
const electronFetch = require("electron-fetch").default;
const electronDl = require("electron-dl");
const bcryptjs = require("bcryptjs");

var main = require("./main");
var flags = require("./flags");
var storage = require("./storage");
var device = require("./device");

var mediaFeatures = {};
var currentUserAgent = null;
var currentLocale = null;
var abortControllers = [];
var copyRsyncProcesses = [];
var extractArchiveProcesses = [];
var downloadFileProcesses = [];
var downloadFileItems = [];
var aptInstallationProcesses = [];

function createAbortControllerId() {
    abortControllers.push(new AbortController());

    return abortControllers.length - 1;
}

exports.registerAbortController = function() {
    return Promise.resolve(createAbortControllerId());
};

exports.triggerAbortController = function(id) {
    if (id >= abortControllers.length) {
        return Promise.reject("ID does not exist");
    }

    abortControllers[id].abort();

    return Promise.resolve();
};

exports.executeCommand = function(command, args = [], stdin = null, stdoutCallback = null, options = {}, abortControllerId = null) {
    if (abortControllerId != null) {
        if (abortControllerId >= abortControllers.length) {
            return Promise.reject("ID does not exist");
        }

        options.signal = abortControllers[abortControllerId].signal;
    }

    return new Promise(function(resolve, reject) {
        var child = child_process.execFile(command, args, {maxBuffer: 8 * (1_024 ** 2), ...options}, function(error, stdout, stderr) {
            if (error) {
                console.error("error:", error);
                console.error("stderr:", stderr);

                reject({stdout, stderr});

                return;
            }

            resolve({stdout, stderr});
        });

        if (stdin != null) {
            var childStream = new stream.Readable();

            childStream.push(stdin);
            childStream.push(null);
            childStream.pipe(child.stdin);
        }

        if (stdoutCallback != null) {
            child.stdout.on("data", function(data) {
                stdoutCallback(data.toString());
            });

            child.stderr.on("data", function(data) {
                stdoutCallback(data.toString());
            });
        }
    });
};

exports.executeOrLogCommand = function(command, args = [], stdin = null, stdoutCallback = null, options = {}, abortControllerId = null) {
    if (!flags.isRealHardware) {
        console.log(`Execute command: ${command} ${args.join(" ")}; stdin: ${stdin}`);

        return Promise.resolve({stdin: null, stdout: null});
    }

    return exports.executeCommand(...arguments);
};

exports.getRootDirectory = function() {
    return Promise.resolve(main.rootDirectory);
};

exports.getFlags = function() {
    return Promise.resolve(flags);
};

exports.getDevice = function() {
    return Promise.resolve(device.data);
};

exports.isInstallationMedia = function() {
    if (flags.emulateInstallationMedia) {
        return Promise.resolve(true);
    }

    if (!flags.isRealHardware) {
        return Promise.resolve(false);
    }

    return exports.executeCommand("df", ["/system"]).then(function(output) {
        var disk = output.stdout.split("\n")[1].split(" ")[0];

        if (disk == "overlay") {
            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    });
};

exports.copyFiles = function(source, destination, privileged = false, exclude = []) {
    var args = ["-ah", "--info=progress2", "--no-inc-recursive"];

    if (privileged) {
        args.unshift("rsync");
    }

    args.push(...exclude.map((path) => `--exclude=${path}`));
    args.push(source, destination);

    var id = copyRsyncProcesses.length;
    var abortControllerId = createAbortControllerId();

    copyRsyncProcesses.push({
        status: "running",
        stdout: "",
        progress: null,
        abortControllerId
    });

    function stdoutCallback(data) {
        copyRsyncProcesses[id].stdout += data;

        var lines = copyRsyncProcesses[id].stdout.split("\r");

        copyRsyncProcesses[id].stdout = lines.slice(lines.length - 2).join("\r");

        if (!lines.slice(lines.length - 2)[0]?.includes("% ")) {
            return;
        }

        var parts = lines.slice(lines.length - 2)[0].trim().split(" ").filter((part) => part != "");

        copyRsyncProcesses[id].progress = Number(parseInt(parts[1]) / 100) || 0;
    }

    exports.executeCommand(privileged ? "sudo" : "rsync", args, null, stdoutCallback, {}, abortControllerId).then(function(output) {
        copyRsyncProcesses[id].status = "success";
    }).catch(function(error) {
        console.error(error);

        copyRsyncProcesses[id].status = "error";
    });

    return Promise.resolve(id);
};

exports.getCopyFileInfo = function(id) {
    if (id >= copyRsyncProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    return Promise.resolve(copyRsyncProcesses[id]);
};

exports.extractArchive = function(source, destination, getProcessId = false) {
    var args = [`${main.rootDirectory}/src/scripts/extractarchive.sh`, storage.getPath(source), storage.getPath(destination)];

    var id = extractArchiveProcesses.length;
    var abortControllerId = createAbortControllerId();

    extractArchiveProcesses.push({
        status: "running",
        stdout: "",
        progress: null,
        abortControllerId
    });

    function stdoutCallback(data) {
        extractArchiveProcesses[id].stdout += data;

        var lines = extractArchiveProcesses[id].stdout.split("\n");
        var lastCompleteLine = lines.slice(lines.length - 2)[0];

        if (!lastCompleteLine?.match(/[0-9]+/)) {
            return;
        }

        extractArchiveProcesses[id].progress = Number(parseInt(lastCompleteLine) / 100) || 0;
    }

    var promise = exports.executeCommand("bash", args, null, stdoutCallback, {}, abortControllerId).then(function(output) {
        extractArchiveProcesses[id].status = "success";

        return Promise.resolve();
    }).catch(function(error) {
        console.error(error);

        extractArchiveProcesses[id].status = "error";

        return Promise.reject(error);
    });

    if (getProcessId) {
        return Promise.resolve(id);
    }

    return promise;
};

exports.getExtractArchiveInfo = function(id) {
    if (id >= extractArchiveProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    return Promise.resolve(extractArchiveProcesses[id]);
};

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

exports.getScreenResolution = function() {
    if (!flags.isRealHardware) {
        return Promise.resolve({
            "desktop": {width: 1024, height: 768}
        }[device.data?.type] || {width: 360, height: 720});
    }

    return exports.executeCommand("xdpyinfo").then(function(output) {
        var matches = output.stdout.match(/^\s*dimensions:\s+([0-9]+)x([0-9]+) pixels/m);

        return Promise.resolve({width: Number(matches[1]), height: Number(matches[2])});
    });
};

exports.shutDown = function() {
    console.log("Shut down called");

    if (!flags.isRealHardware) {
        electron.app.exit(0);

        return Promise.resolve();
    }

    return exports.executeCommand("sudo", ["shutdown", "-h", "now"]);
};

exports.restart = function() {
    console.log("Restart called");

    if (!flags.isRealHardware) {
        electron.app.relaunch();
        electron.app.exit(0);

        return Promise.resolve();
    }

    return exports.executeCommand("sudo", ["reboot"]);
};

exports.sleep = function() {
    console.log("Sleep called");

    if (!flags.isRealHardware) {
        return Promise.resolve();
    }

    return exports.executeCommand("sudo", ["systemctl", "suspend"]);
};

exports.getPowerState = function() {
    if (!(
        typeof(device.data?.hardware?.batteryStateReporter) == "string" &&
        typeof(device.data?.hardware?.batteryStateMapping) == "object" &&
        typeof(device.data?.hardware?.batteryLevelReporter) == "string"
    )
    ) {
        // Invalid device description for battery
        return Promise.resolve({
            state: null,
            level: 100
        });
    }

    try {
        return Promise.resolve({
            state: device.data?.hardware?.batteryStateMapping?.[fs.readFileSync(String(device.data?.hardware.batteryStateReporter), "utf8").split("\n")[0]] || null,
            level: parseInt(fs.readFileSync(String(device.data?.hardware.batteryLevelReporter), "utf8").split("\n")[0])
        });
    } catch (e) {
        return Promise.reject(e);
    }
};

exports.setColourScheme = function(scheme = "light") {
    if (!["light", "dark"].includes(scheme)) {
        return Promise.reject("Invalid colour scheme");
    }

    electron.nativeTheme.themeSource = scheme;

    return Promise.resolve();
};

exports.setMediaFeatures = function(features = mediaFeatures) {
    mediaFeatures = features;

    return Promise.all(electron.webContents.getAllWebContents().map(function(webContents) {
        main.ensureDebuggerAttached(webContents);

        return webContents.debugger.sendCommand("Emulation.setEmulatedMedia", {
            features: Object.keys(features).map((name) => ({name, value: features[name]}))
        });
    }));
};

exports.setMediaFeature = function(name, value) {
    mediaFeatures[name] = value;

    return exports.setMediaFeatures();
};

exports.getMediaFeatures = function() {
    return Promise.resolve(mediaFeatures);
};

exports.acknowledgeUserAgent = function(userAgent) {
    currentUserAgent = userAgent;
};

exports.setLocale = function(localeCode = currentLocale) {
    currentLocale = localeCode;

    return Promise.all(electron.webContents.getAllWebContents().map(function(webContents) {
        var hyphenLocaleCode = localeCode.replace(/_/g, "-");

        webContents.session.setSpellCheckerLanguages([
            webContents.session.availableSpellCheckerLanguages.includes(hyphenLocaleCode) ? hyphenLocaleCode : localeCode.split("_")[0]
        ]);

        main.ensureDebuggerAttached(webContents);

        return webContents.debugger.sendCommand("Emulation.setUserAgentOverride", {
            userAgent: currentUserAgent,
            acceptLanguage: hyphenLocaleCode
        });
    }));
};

exports.setKeyboardLayout = function(layout, variant = null) {
    var args = ["-layout", layout];

    if (variant) {
        args.push("-variant", variant);
    }

    return exports.executeCommand("setxkbmap", args);
};

exports.bcryptHash = function(data, saltRounds) {
    return new Promise(function(resolve, reject) {
        bcryptjs.hash(data, saltRounds, function(error, hash) {
            if (error) {
                reject(error);

                return;
            }

            resolve(hash);
        });
    });
};

exports.bcryptCompare = function(data, hash) {
    return new Promise(function(resolve, reject) {
        bcryptjs.compare(data, hash, function(error, result) {
            if (error) {
                reject(error);

                return;
            }

            resolve(result);
        });
    });
};

function networkSsidToQualifiedName(ssid) {
    return `wifi/${ssid}`;
}

function networkQualifiedNameToSsid(name) {
    return name.replace(/^wifi\//, "");
}

exports.networkList = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve([]);
    }

    return exports.executeCommand("nmcli", ["--terse", "--escape", "yes", "--colors", "no", "--get-values", "name,type,active", "connection"]).then(function(output) {
        var lines = output.stdout.split("\n").filter((line) => line != "");

        return lines.map(function(line) {
            var data = exports.parseNmcliLine(line);

            return {
                name: networkQualifiedNameToSsid(data[0]),
                qualifiedName: data[0],
                type: {
                    "802-11-wireless": "wifi",
                    "802-3-ethernet": "ethernet"
                }[data[1]] || "unknown",
                connected: data[2] == "yes"
            };
        });
    });
};

exports.networkScanWifi = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve([]);
    }

    return exports.executeCommand("nmcli", ["device", "wifi", "rescan"]).then(function() {
        return exports.executeCommand("nmcli", ["--terse", "--escape", "yes", "--colors", "no", "--get-values", "ssid,bssid,chan,rate,signal,security,active", "device", "wifi", "list"]);
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

exports.networkDisconnectWifi = function(name) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.networkList().then(function(results) {
        var matchingResults = results.filter((result) => result.qualifiedName == networkSsidToQualifiedName(name) && result.connected);

        if (matchingResults.length == 0) {
            return Promise.resolve();
        }

        return exports.executeCommand("nmcli", ["connection", "down", networkSsidToQualifiedName(name)]);
    });
};

exports.networkForgetWifi = function(name) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.networkList().then(function(results) {
        var matchingResults = results.filter((result) => result.qualifiedName == networkSsidToQualifiedName(name));

        if (matchingResults.length == 0) {
            return Promise.resolve();
        }

        return exports.executeCommand("nmcli", ["connection", "delete", networkSsidToQualifiedName(name)]); // This should also disconnect if already connected
    });
};

exports.networkConfigureWifi = function(name, auth = {}) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.networkForgetWifi(name).then(function() {
        return exports.executeCommand("nmcli", ["connection", "add", "type", "wifi", "connection.id", networkSsidToQualifiedName(name), "ssid", name, ...Object.entries(auth).flat()]);
    });
};

exports.networkConnectWifi = function(name) {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve();
    }

    return exports.networkDisconnectWifi().then(function() {
        return exports.executeCommand("nmcli", ["device", "wifi", "connect", name], null);
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
    var abortControllerId = createAbortControllerId();

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

    abortControllers[abortControllerId].signal.onabort = function() {
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

    downloadFileProcesses[id].status = "paused";

    downloadFileItems[id]?.pause();
};

exports.resumeFileDownload = function(id) {
    if (id >= downloadFileProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    downloadFileProcesses[id].status = "running";

    downloadFileItems[id]?.resume();
};

exports.cancelFileDownload = function(id) {
    if (id >= downloadFileProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    downloadFileProcesses[id].status = "cancelled";

    downloadFileItems[id]?.cancel();
};

exports.aptInstallPackages = function(packageNames, downloadOnly = false) {
    var args = ["apt-get", "install", "-o", "APT::Status-Fd=1"];

    if (downloadOnly) {
        args.push("--download-only");
    }

    args.push(...packageNames);

    var id = aptInstallationProcesses.length;
    var abortControllerId = createAbortControllerId();

    aptInstallationProcesses.push({
        status: "running",
        stdout: "",
        progress: null,
        abortControllerId
    });

    function stdoutCallback(data) {
        aptInstallationProcesses[id].stdout += data;

        var lines = aptInstallationProcesses[id].stdout.split("\n");

        aptInstallationProcesses[id].stdout = lines.slice(lines.length - 2).join("\n");

        var match = lines.slice(lines.length - 2)[0]?.match(/^(?:dlstatus|pmstatus):(\d+\.\d+)/);

        if (!match) {
            return;
        }

        aptInstallationProcesses[id].progress = parseFloat(match[1]) / 100;
    }

    if (packageNames.length == 0) {
        aptInstallationProcesses[id].status = "success";

        return Promise.resolve(id);
    }

    exports.executeCommand("sudo", args, null, stdoutCallback, {
        env: {
            "DEBIAN_FRONTEND": "noninteractive"
        }
    }, abortControllerId).then(function(output) {
        aptInstallationProcesses[id].status = "success";
    }).catch(function(error) {
        console.error(error);

        aptInstallationProcesses[id].status = "error";
    });

    return Promise.resolve(id);
};

exports.getAptInstallationInfo = function(id) {
    if (id >= aptInstallationProcesses.length) {
        return Promise.reject("ID does not exist");
    }

    return Promise.resolve(aptInstallationProcesses[id]);
};

exports.getLinuxUsersList = function() {
    if (!flags.isRealHardware && !flags.allowHostControl) {
        return Promise.resolve([]);
    }

    var passwdEntries = fs.readFileSync("/etc/passwd", "utf8");

    return Promise.resolve(passwdEntries
        .split("\n")
        .filter((line) => line != "")
        .map((line) => line.split(":")[0])
    );
};

exports.devRestart = function() {
    if (!flags.isRealHardware) {
        electron.app.relaunch();
    }

    electron.app.exit();

    return Promise.resolve();
};