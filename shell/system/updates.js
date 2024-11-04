/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as openpgp from "gshell://lib/openpgp.min.mjs";

import * as about from "gshell://about.js";
import * as system from "gshell://system/system.js";
import * as device from "gshell://system/device.js";
import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";
import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export const UPDATE_SOURCE_URL_BASE = "https://liveg.tech/os/updates";

const UPDATE_CHECK_FREQUENCY_MIN = 22 * 60 * 60 * 1_000; // 22 hours
const UPDATE_CHECK_FREQUENCY_RANDOM = 2 * 60 * 60 * 1_000; // 2 hours

const UPDATE_RETRIEVAL_OPTIONS = {
    headers: {
        "Cache-Control": "no-cache"
    }
};

const DUMMY_APT_CACHE_DEPENDS_STDOUT = `\
package-a
  Depends: package-b
  Depends: package-c
package-b
package-b:i386
package-c
  package-d
<package-e>
<package-e:i386>
`;

const DUMMY_APT_CACHE_SHOW_STDOUT = `\
Package: package-a
Architecture: amd64
Version: 1.0.0
Installed-Size: 123
Depends: package-b (= 2.0.0), package-c (>= 3.0.0)
Filename: pool/example/package-a_1.0.0-amd64.deb
Size: 456789
Description: A dummy package
 This is a dummy package used for testing purposes only on
 non-real hardware.

Package: package-b
Architecture: amd64
Version: 1.0.0
Installed-Size: 456
Depends: package-a (= 2.0.0), package-c (>= 3.0.0)
Filename: pool/example/package-b_1.0.0-amd64.deb
Size: 789123
Description: A dummy package
 This is a dummy package used for testing purposes only on
 non-real hardware.

Package: package-c
Architecture: amd64
Version: 1.0.0
Installed-Size: 789
Depends: package-a (= 2.0.0), package-b (>= 3.0.0)
Filename: pool/example/package-c_1.0.0-amd64.deb
Size: 123456
Description: A dummy package
 This is a dummy package used for testing purposes only on
 non-real hardware.
`;

export var updateCircuit = null;
export var shouldAutoCheckForUpdates = false;
export var index = null;
export var indexSignedKeyHex = null;
export var bestUpdate = null;
export var loadingIndex = false;
export var checkingFailed = false;
export var updateInProgress = false;
export var canCancelUpdate = true;
export var updateCancelled = false;
export var currentUpdateAbortControllerId = null;
export var shouldAutoRestart = false;

var flags = {};
var lastUpdateStatus = null;
var lastUpdateProgress = null;
var pendingUpdateStatus = null;
var pendingUpdateProgress = null;

// TODO: Prevent starting updates in Installation Media

function getEnvironmentVariables(update, shell = false) {
    return {
        [shell ? "PLATFORM" : "platform"]: device.data?.platform,
        [shell ? "MODEL_CODENAME" : "modelCodename"]: device.data?.model?.codename,
        [shell ? "VERNUM" : "vernum"]: update.vernum,
        [shell ? "VERSION" : "version"]: update.version,
        [shell ? "OLD_VERNUM" : "oldVernum"]: about.VERNUM,
        [shell ? "OLD_VERSION" : "oldVersion"]: about.VERSION
    };
}

function filterConditions(update, items) {
    return items.filter(function(item) {
        if (!item.condition) {
            return true;
        }

        var vars = getEnvironmentVariables(update);

        return (new Function(...Object.keys(vars), `return ${item.condition};`))(...Object.values(vars));
    });
}

function makeError(code) {
    return function(error) {
        console.error(error);

        return Promise.reject(code);
    }
}

// Dummy delay which is used for testing UI flow on non-real hardware only
function dummyDelay() {
    if (flags.isRealHardware) {
        return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
        console.log("Dummy delay enforced");

        setTimeout(function() {
            if (updateCancelled) {
                reject("GOS_UPDATE_CANCELLED");

                return;
            }

            resolve();
        }, 3_000);
    });
}

export function getPackagesToDownload(packagesToInstall, skipUnknowns = false) {
    var packages;
    var promiseChain = Promise.resolve();
    var outputs = [];

    if (packagesToInstall.length == 0) {
        return Promise.resolve([]);
    }

    packagesToInstall.forEach(function(name) {
        promiseChain = promiseChain.then(function() {
            return gShell.call("system_executeCommand", {
                command: "apt-cache",
                args: ["depends", "--recurse", "--no-suggests", "--no-conflicts", "--no-breaks", "--no-replaces", "--no-enhances", name]
            }).then(function(output) {
                outputs.push(output);

                return Promise.resolve();
            });
        }).catch(function(error) {
            if (skipUnknowns) {
                return Promise.resolve();
            }

            return Promise.reject(error);
        });
    });

    return promiseChain.then(function() {
        var names = [];

        outputs.forEach(function(output) {
            var stdout = flags.isRealHardware ? output.stdout : DUMMY_APT_CACHE_DEPENDS_STDOUT;

            names.push(...[...stdout.matchAll(/^[a-z0-9+-.]+$/gm)].map((match) => match[0]));
        });

        names = [...new Set(names)];

        packages = names.map((name) => ({name}));

        return gShell.call("system_executeCommand", {
            command: "apt-cache",
            args: ["show", "--no-all-versions", ...names]
        });
    }).then(function(output) {
        var stdout = flags.isRealHardware ? output.stdout : DUMMY_APT_CACHE_SHOW_STDOUT;

        stdout.split(/\nPackage: /).forEach(function(packageResult, i) {
            if (packageResult.match(/^Size: (\d+)$/m)) {
                packages[i].downloadSize = Number(packageResult.match(/^Size: (\d+)$/m)[1]);
            } else {
                packages[i].downloadSize = 0;
            }

            if (packageResult.match(/^Installed-Size: (\d+)$/m)) {
                packages[i].installedSize = Number(packageResult.match(/^Installed-Size: (\d+)$/m)[1]) * 1_024;
            } else {
                packages[i].installedSize = packages[i].downloadSize;
            }
        });

        return packages;
    });
}

export function getPackagesToDownloadForUpdate(update, skipUnknowns = false) {
    return getPackagesToDownload(
        filterConditions(update, update.packages)
            .map((updatePackage) => `${updatePackage.name}=${updatePackage.version}`)
        ,
        skipUnknowns
    );
}

export function getEstimatedUpdateDownloadSize(update) {
    var archiveSize;

    return gShell.call("network_getContentLength", {url: new URL(update.archivePath, `${UPDATE_SOURCE_URL_BASE}/`).href}).then(function(size) {
        archiveSize = size;

        return getPackagesToDownloadForUpdate(update, true);
    }).then(function(packages) {
        var packagesSize = packages
            .map((updatePackage) => updatePackage.downloadSize)
            .reduce((accumulator, value) => accumulator + value, 0)
        ;

        return Promise.resolve({archiveSize, packagesSize, totalSize: archiveSize + packagesSize});
    });
}

export function findBestUpdate(updates = index.updates) {
    var bestUpdate = null;

    updates.forEach(function(update) {
        if (update.vernum <= about.VERNUM) {
            return;
        }

        if (update.circuit != updateCircuit) {
            return;
        }

        if (update.minSupportedVernum > about.VERNUM) {
            return;
        }

        if (!update.supportedPlatforms.includes(device.data?.platform)) {
            return;
        }

        if (bestUpdate == null) {
            bestUpdate = update;

            return;
        }

        if (update.vernum <= bestUpdate.vernum) {
            return;
        }

        bestUpdate = update;
    });

    return bestUpdate;
}

export function getUpdates() {
    console.log("System update information request made");

    var publicKey;
    var indexData;
    var indexMessage;

    loadingIndex = true;
    checkingFailed = false;

    privilegedInterface.setData("updates_loadingIndex", loadingIndex);
    privilegedInterface.setData("updates_checkingFailed", checkingFailed);

    return fetch("gshell://trust/liveg/public.pgp").then(function(response) {
        return response.text();
    }).then(function(data) {
        return openpgp.readKey({armoredKey: data});
    }).then(function(key) {
        publicKey = key;

        return fetch(`${UPDATE_SOURCE_URL_BASE}/index.json`, UPDATE_RETRIEVAL_OPTIONS);
    }).then(function(response) {
        return response.text();
    }).then(function(data) {
        indexData = data;

        return openpgp.createMessage({text: indexData});
    }).then(function(message) {
        indexMessage = message;

        return fetch(`${UPDATE_SOURCE_URL_BASE}/index.json.sig`, UPDATE_RETRIEVAL_OPTIONS);
    }).then(function(response) {
        return response.text();
    }).then(function(data) {
        return openpgp.readSignature({
            armoredSignature: data
        });
    }).then(function(signature) {
        return openpgp.verify({
            message: indexMessage,
            signature,
            verificationKeys: publicKey
        });
    }).then(function(verification) {
        var signatureResult = verification.signatures[0];

        if (!signatureResult.verified) {
            return Promise.reject("Verification of update index file against signature has failed");
        }

        indexSignedKeyHex = signatureResult.keyID.toHex();

        try {
            index = JSON.parse(indexData);
        } catch (e) {
            return Promise.reject(e);
        }

        bestUpdate = findBestUpdate();
        loadingIndex = false;

        return bestUpdate != null ? getEstimatedUpdateDownloadSize(bestUpdate) : Promise.resolve(null);
    }).then(function(sizeData) {
        if (bestUpdate != null) {
            bestUpdate.estimatedDownloadSize = sizeData.totalSize;
        }

        console.log("Best update found:", bestUpdate);

        privilegedInterface.setData("updates_index", index);
        privilegedInterface.setData("updates_indexSignedKeyHex", indexSignedKeyHex);
        privilegedInterface.setData("updates_bestUpdate", bestUpdate);
        privilegedInterface.setData("updates_loadingIndex", loadingIndex);

        return Promise.resolve(index);
    }).catch(function(error) {
        loadingIndex = false;
        checkingFailed = true;

        privilegedInterface.setData("updates_checkingFailed", checkingFailed);
        privilegedInterface.setData("updates_loadingIndex", loadingIndex);

        return Promise.reject(error);
    });
}

function setUpdateProgress(status, progress = null) {
    if (status != lastUpdateStatus) {
        privilegedInterface.setData("updates_updateStatus", status);
        privilegedInterface.setData("updates_updateProgress", progress);

        lastUpdateStatus = status;
        lastUpdateProgress = progress;
    }

    pendingUpdateStatus = status;
    pendingUpdateProgress = progress;
}

function executeScript(update, path) {
    if (!path) {
        return Promise.resolve();
    }

    return gShell.call("storage_getPath", {location: `update/${path}`}).then(function(path) {
        return gShell.call("system_executeCommand", {
            command: "chmod",
            args: ["+x", path]
        }).then(function() {
            return gShell.call("system_executeCommand", {
                command: path,
                options: {
                    env: getEnvironmentVariables(update, true)
                }
            });
        });
    });
}

export function startUpdate(update) {
    if (updateInProgress) {
        return makeError("GOS_UPDATE_ALREADY_IN_PROGRESS");
    }

    var updateId = $g.core.generateKey();
    var packageNames = filterConditions(update, update.packages).map((updatePackage) => `${updatePackage.name}=${updatePackage.version}`);
    var updateFiles = filterConditions(update, update.files);
    var downloadSizeData;

    updateInProgress = true;
    canCancelUpdate = true;
    updateCancelled = false;
    currentUpdateAbortControllerId = null;

    privilegedInterface.setData("updates_updateInProgress", updateInProgress);
    privilegedInterface.setData("updates_canCancelUpdate", canCancelUpdate);

    setUpdateProgress("updatingDownloadSources");

    return gShell.call("system_registerAbortController").then(function(abortControllerId) {
        currentUpdateAbortControllerId = abortControllerId;

        return users.getCurrentUser();
    }).then(function(user) {
        return config.edit("updates.gsc", function(data) {
            data.history ||= [];

            data.history.push({
                id: updateId,
                version: update.version,
                vernum: update.vernum,
                oldVersion: about.VERSION,
                oldVernum: about.VERNUM,
                status: "started",
                startedAt: Date.now(),
                startedBy: user.uid,
                updateCircuit
            });

            return Promise.resolve(data);
        });
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["apt-get", "update"],
            abortControllerId: currentUpdateAbortControllerId
        }).catch(makeError("GOS_UPDATE_FAIL_PKG_LIST")).then(dummyDelay);
    }).then(function() {
        return getEstimatedUpdateDownloadSize(update).catch(makeError("GOS_UPDATE_FAIL_GET_ARCHIVE_DL_SIZE"));
    }).then(function(sizeData) {
        downloadSizeData = sizeData;

        setUpdateProgress("downloading", 0);

        return gShell.call("network_downloadFile", {
            url: new URL(update.archivePath, `${UPDATE_SOURCE_URL_BASE}/`).href,
            destination: "update.tar.gz",
            getProcessId: true
        }).catch(makeError("GOS_UPDATE_FAIL_START_ARCHIVE_DL"));
    }).then(function(id) {
        return new Promise(function(resolve, reject) {
            (function poll() {
                gShell.call("network_getDownloadFileInfo", {id}).then(function(info) {
                    setUpdateProgress("downloading", info.progress * (downloadSizeData.archiveSize / downloadSizeData.totalSize));

                    if (updateCancelled) {
                        gShell.call("system_triggerAbortController", {id: info.abortControllerId});

                        reject("GOS_UPDATE_CANCELLED");

                        return;
                    }

                    switch (info.status) {
                        case "running":
                            requestAnimationFrame(poll);
                            break;

                        case "success":
                            resolve();
                            break;

                        case "error":
                            reject("GOS_UPDATE_FAIL_ARCHIVE_DL");
                            break;

                        case "cancelled":
                            reject("GOS_UPDATE_CANCELLED");
                            break;

                        default:
                            reject("GOS_UPDATE_IMPL_BAD_ARCHIVE_DL_STATUS");
                            break;
                    }
                });
            })();
        });
    }).then(function() {
        if (!flags.isRealHardware) {
            return dummyDelay();
        }

        return gShell.call("system_aptInstallPackages", {
            packageNames,
            downloadOnly: true
        }).catch(makeError("GOS_UPDATE_FAIL_START_PKG_DL"));
    }).then(function(id) {
        if (!flags.isRealHardware) {
            return dummyDelay();
        }

        return new Promise(function(resolve, reject) {
            (function poll() {
                gShell.call("system_getAptInstallationInfo", {id}).then(function(info) {
                    setUpdateProgress("downloading",
                        (downloadSizeData.archiveSize / downloadSizeData.totalSize) +
                        (info.progress * (downloadSizeData.packagesSize / downloadSizeData.totalSize))
                    );

                    if (updateCancelled) {
                        gShell.call("system_triggerAbortController", {id: info.abortControllerId});

                        reject("GOS_UPDATE_CANCELLED");

                        return;
                    }

                    switch (info.status) {
                        case "running":
                            requestAnimationFrame(poll);
                            break;

                        case "success":
                            resolve();
                            break;

                        case "error":
                            reject("GOS_UPDATE_FAIL_PKG_DL");
                            break;

                        default:
                            reject("GOS_UPDATE_IMPL_BAD_PKG_DL_STATUS");
                            break;
                    }
                });
            })();
        });
    }).then(function() {
        setUpdateProgress("extracting", 0);

        return gShell.call("storage_delete", {
            location: "update"
        }).catch(makeError("GOS_UPDATE_FAIL_DEL_FOLDER"));
    }).then(function() {
        return gShell.call("storage_newFolder", {
            location: "update"
        }).catch(makeError("GOS_UPDATE_FAIL_NEW_FOLDER"));
    }).then(function() {
        return gShell.call("system_extractArchive", {
            source: "update.tar.gz",
            destination: "update",
            getProcessId: true
        }).catch(makeError("GOS_UPDATE_FAIL_START_ARCHIVE_EXTRACT"));
    }).then(function(id) {
        return new Promise(function(resolve, reject) {
            (function poll() {
                gShell.call("system_getExtractArchiveInfo", {id}).then(function(info) {
                    setUpdateProgress("extracting", info.progress || 0);

                    if (updateCancelled) {
                        gShell.call("system_triggerAbortController", {id: info.abortControllerId});

                        reject("GOS_UPDATE_CANCELLED");

                        return;
                    }

                    switch (info.status) {
                        case "running":
                            requestAnimationFrame(poll);
                            break;

                        case "success":
                            resolve();
                            break;

                        case "error":
                            reject("GOS_UPDATE_FAIL_ARCHIVE_EXTRACT");
                            break;

                        default:
                            reject("GOS_UPDATE_IMPL_BAD_ARCHIVE_EXTRACT_STATUS");
                            break;
                    }
                });
            })();
        });
    }).then(function() {
        return gShell.call("storage_delete", {
            location: "update.tar.gz"
        }).catch(makeError("GOS_UPDATE_FAIL_DEL_ARCHIVE"));
    }).then(function() {
        if (updateCancelled) {
            return Promise.reject("GOS_UPDATE_CANCELLED");
        }

        // Point of no return: cannot cancel update from this point onwards

        canCancelUpdate = false;
        updateCancelled = false;

        privilegedInterface.setData("updates_canCancelUpdate", canCancelUpdate);

        setUpdateProgress("installing", null);
    }).then(function() {
        if (update.rollbackScriptPath) {
            return gShell.call("storage_getPath", {location: `update/${update.rollbackScriptPath}`}).then(function(path) {
                return gShell.call("system_executeCommand", {
                    command: "cp",
                    args: [path, "/system/scripts/update-rollback.sh"],
                    options: {
                        env: getEnvironmentVariables(update, true)
                    }
                });
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "touch",
                    args: ["/system/gshell-staging-rollback"]
                });
            }).catch(makeError("GOS_UPDATE_FAIL_COPY_ROLLBACK_SCRIPT"));
        }

        return Promise.resolve();
    }).then(function() {
        return executeScript(update, update.preinstallScriptPath).catch(makeError("GOS_UPDATE_FAIL_PREINSTALL_SCRIPT"));
    }).then(function() {
        setUpdateProgress("installing", 0);

        if (!flags.isRealHardware) {
            return dummyDelay();
        }

        return gShell.call("system_aptInstallPackages", {packageNames}).catch(makeError("GOS_UPDATE_FAIL_START_PKG_INSTALL"));
    }).then(function(id) {
        if (!flags.isRealHardware) {
            return Promise.resolve();
        }

        return new Promise(function(resolve, reject) {
            (function poll() {
                gShell.call("system_getAptInstallationInfo", {id}).then(function(info) {
                    setUpdateProgress("installing", info.progress * (1 / 2));

                    switch (info.status) {
                        case "running":
                            requestAnimationFrame(poll);
                            break;

                        case "success":
                            resolve();
                            break;

                        case "error":
                            reject("GOS_UPDATE_FAIL_PKG_INSTALL");
                            break;

                        default:
                            reject("GOS_UPDATE_IMPL_BAD_PKG_INSTALL_STATUS");
                            break;
                    }
                });
            })();
        });
    }).then(function() {
        var promiseChain = Promise.resolve();
        var fileSizes = {};

        updateFiles.forEach(function(file) {
            promiseChain = promiseChain.then(function() {
                return gShell.call("storage_stat", {location: `update/${file.path}`}).then(function(stats) {
                    fileSizes[file.path] = stats.size;
    
                    return Promise.resolve();
                }).catch(makeError("GOS_UPDATE_FAIL_STAT_FILE"));
            })
        });

        return promiseChain.then(function() {
            return Promise.resolve(fileSizes);
        });
    }).then(function(fileSizes) {
        setUpdateProgress("installing", 1 / 2);

        var promiseChain = Promise.resolve();
        var totalFileSize = Object.values(fileSizes).reduce((accumulator, value) => accumulator + value, 0);
        var completedFileSize = 0;

        updateFiles.forEach(function(file) {
            promiseChain = promiseChain.then(function() {
                setUpdateProgress("installing",
                    (1 / 2) + (((completedFileSize + fileSizes[file.path]) / totalFileSize) * (1 / 2))
                );

                if (!flags.isRealHardware) {
                    return dummyDelay().then(function() {
                        completedFileSize += fileSizes[file.path];

                        return Promise.resolve();
                    });
                }

                return gShell.call("storage_getPath", {location: `update/${file.path}`}).then(function(path) {
                    return gShell.call("system_copyFiles", {
                        source: path,
                        destination: file.destinationPath,
                        privileged: true
                    }).catch(makeError("GOS_UPDATE_FAIL_START_COPY_FILES"));
                }).then(function(id) {
                    return new Promise(function(resolve, reject) {
                        (function poll() {
                            gShell.call("system_getCopyFileInfo", {id}).then(function(info) {
                                setUpdateProgress("installing",
                                    (1 / 2) + (((completedFileSize + (fileSizes[file.path] * info.progress)) / totalFileSize) * (1 / 2))
                                );
       
                                switch (info.status) {
                                    case "running":
                                        requestAnimationFrame(poll);
                                        break;
        
                                    case "success":
                                        resolve();
                                        break;
        
                                    case "error":
                                        reject("GOS_UPDATE_FAIL_COPY_FILES");
                                        break;
        
                                    default:
                                        reject("GOS_UPDATE_IMPL_BAD_COPY_STATUS");
                                        break;
                                }
                            });
                        })();
                    });
                }).then(function() {
                    completedFileSize += fileSizes[file.path];
    
                    return Promise.resolve();
                });
            });
        });

        return promiseChain;
    }).then(function() {
        setUpdateProgress("installing", null);

        return executeScript(update, update.postinstallScriptPath).catch(makeError("GOS_UPDATE_FAIL_POSTINSTALL_SCRIPT"));
    }).then(function() {
        if (update.rebootScriptPath) {
            return gShell.call("storage_getPath", {location: `update/${update.rebootScriptPath}`}).then(function(path) {
                return gShell.call("system_executeCommand", {
                    command: "cp",
                    args: [path, "/system/scripts/update-reboot.sh"]
                });
            }).catch(makeError("GOS_UPDATE_FAIL_COPY_REBOOT_SCRIPT"));
        }

        return Promise.resolve();
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "touch",
            args: ["/system/gshell-staging-ready"]
        });
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "rm",
            args: ["-f", "/system/gshell-staging-rollback"]
        });
    }).then(function() {
        return config.edit("updates.gsc", function(data) {
            data.history ||= [];

            var currentEntry = data.history.find((entry) => entry.id == updateId);

            if (currentEntry) {
                currentEntry.status = "successful";
                currentEntry.completedAt = Date.now();
            }

            return Promise.resolve(data);
        });
    }).then(function() {
        if (shouldAutoRestart) {
            var countdownValue = 10;

            privilegedInterface.setData("updates_autoRestartCountdownValue", countdownValue);

            var countdownInterval = setInterval(function() {
                countdownValue--;

                privilegedInterface.setData("updates_autoRestartCountdownValue", countdownValue);

                if (!shouldAutoRestart) {
                    clearInterval(countdownInterval);

                    return;
                }

                if (countdownValue == 0) {
                    clearInterval(countdownInterval);
                    
                    system.restart("toFinishUpdate");
                }
            }, 1_000);
        }

        setUpdateProgress("readyToRestart");

        return Promise.resolve();
    }).catch(function(error) {
        console.error("Error occurred during update:", error);

        if (updateCancelled) {
            error = "GOS_UPDATE_CANCELLED";
        }

        updateInProgress = false;
        canCancelUpdate = true;
        updateCancelled = false;

        privilegedInterface.setData("updates_updateInProgress", updateInProgress);
        privilegedInterface.setData("updates_canCancelUpdate", canCancelUpdate);

        if (error == "GOS_UPDATE_CANCELLED") {
            return config.edit("updates.gsc", function(data) {
                data.history ||= [];
    
                var currentEntry = data.history.find((entry) => entry.id == updateId);
    
                if (currentEntry) {
                    currentEntry.status = "cancelled";
                    currentEntry.completedAt = Date.now();
                }
    
                return Promise.resolve(data);
            });
        }

        return config.edit("updates.gsc", function(data) {
            data.history ||= [];

            var currentEntry = data.history.find((entry) => entry.id == updateId);

            if (currentEntry) {
                currentEntry.status = "failed";
                currentEntry.error = error;
                currentEntry.completedAt = Date.now();
            }

            return Promise.resolve(data);
        }).then(function() {
            return Promise.reject(error);
        });
    });
}

export function cancelUpdate() {
    if (!updateInProgress) {
        return Promise.reject("No update is in progress");
    }

    if (!canCancelUpdate) {
        return Promise.reject("Cannot cancel update at this time");
    }

    if (!updateCancelled) {
        updateCancelled = true;
        canCancelUpdate = false;

        if (currentUpdateAbortControllerId != null) {
            return gShell.call("system_triggerAbortController", {id: currentUpdateAbortControllerId});
        }
    }

    return Promise.resolve();
}

export function startUpdateCheckTimer() {
    setTimeout(function() {
        if (shouldAutoCheckForUpdates) {
            getUpdates();
        }

        startUpdateCheckTimer();
    }, UPDATE_CHECK_FREQUENCY_MIN + (Math.random() * UPDATE_CHECK_FREQUENCY_RANDOM));
}

export function load() {
    var shouldNoteUpdateRolledBack = false;

    return config.read("updates.gsc").then(function(data) {
        updateCircuit = data.updateCircuit || "alpha"; // TODO: Change when we make our first Beta or Main releases
        shouldAutoCheckForUpdates = !!data.shouldAutoCheckForUpdates;

        privilegedInterface.setData("updates_updateCircuit", updateCircuit);
        privilegedInterface.setData("updates_shouldAutoCheckForUpdates", shouldAutoCheckForUpdates);

        return config.edit("updates.gsc", function(data) {
            data.history ||= [];

            data.history.forEach(function(entry) {
                if (entry.status == "started") {
                    entry.status = "failed";
                    entry.error = "GOS_UPDATE_FAIL_UNSCHEDULED_SHUTDOWN";
                    entry.completedAt = Date.now();

                    shouldNoteUpdateRolledBack = true;
                }
            });
    
            return Promise.resolve(data);
        });
    }).then(function() {
        return gShell.call("storage_exists", {location: "update-rolled-back"});
    }).then(function(rollbackFlagExists) {
        if (!rollbackFlagExists) {
            return Promise.resolve();
        }

        shouldNoteUpdateRolledBack = true;

        return gShell.call("storage_delete", {location: "update-rolled-back"});
    }).then(function() {
        if (shouldNoteUpdateRolledBack) {
            // TODO: It might be better to have this as a notification
            $g.sel("#updates_rolledBackDialog").dialogOpen();
        }
    });
}

export function setUpdateCircuit(value) {
    updateCircuit = value;

    privilegedInterface.setData("updates_updateCircuit", value);

    getUpdates();

    return config.edit("updates.gsc", function(data) {
        data["updateCircuit"] = value;

        return Promise.resolve(data);
    });
}

export function setShouldAutoCheckForUpdates(value) {
    shouldAutoCheckForUpdates = value;

    privilegedInterface.setData("updates_shouldAutoCheckForUpdates", value);

    getUpdates();

    return config.edit("updates.gsc", function(data) {
        data["shouldAutoCheckForUpdates"] = value;

        return Promise.resolve(data);
    });
}

export function setShouldAutoRestart(value) {
    shouldAutoRestart = value;

    privilegedInterface.setData("updates_shouldAutoRestart", value);

    return Promise.resolve();
}

export function init() {
    gShell.call("system_getFlags").then(function(result) {
        flags = result;

        setUpdateProgress("notStarted");

        privilegedInterface.setData("updates_shouldAutoRestart", false);

        startUpdateCheckTimer();

        if (shouldAutoCheckForUpdates) {
            getUpdates();
        }
    });

    setInterval(function() {
        if (pendingUpdateStatus == lastUpdateStatus && pendingUpdateProgress == lastUpdateProgress) {
            return;
        }

        privilegedInterface.setData("updates_updateStatus", pendingUpdateStatus);
        privilegedInterface.setData("updates_updateProgress", pendingUpdateProgress);

        lastUpdateStatus = pendingUpdateStatus;
        lastUpdateProgress = pendingUpdateProgress;
    }, 500);
}