/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as openpgp from "gshell://lib/openpgp.min.mjs";

import * as about from "gshell://about.js";
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

var flags = {};

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

export function getPackagesToDownload(packagesToInstall) {
    var packages;

    return Promise.all(packagesToInstall.map((name) => gShell.call("system_executeCommand", {
        command: "apt-cache",
        args: ["depends", "--recurse", "--no-suggests", "--no-conflicts", "--no-breaks", "--no-replaces", "--no-enhances", name]
    }))).then(function(outputs) {
        var names = [];

        outputs.forEach(function(output) {
            var stdout = flags.isRealHardware ? output.stdout : DUMMY_APT_CACHE_DEPENDS_STDOUT;

            names.push(...[...stdout.matchAll(/^[a-z0-9+-.]+$/gm)].map((match) => match[0]));
        });

        packages = [...new Set(names)].map((name) => ({name}));

        return Promise.all(names.map((name) => gShell.call("system_executeCommand", {
            command: "apt-cache",
            args: ["show", "--no-all-versions", name]
        })));
    }).then(function(outputs) {
        outputs.forEach(function(output, i) {
            var stdout = flags.isRealHardware ? output.stdout : DUMMY_APT_CACHE_SHOW_STDOUT;

            packages[i].downloadSize = Number(stdout.match(/^Size: (\d+)$/m)[1]);
            packages[i].installedSize = Number(stdout.match(/^Installed-Size: (\d+)$/m)[1]) * 1_024;
        });

        return packages;
    });
}

export function getPackagesToDownloadForUpdate(update) {
    return getPackagesToDownload(filterConditions(update, update.packages)
        .map((updatePackage) => `${updatePackage.name}=${updatePackage.version}`)
    );
}

export function getEstimatedUpdateDownloadSize(update) {
    var archiveSize;

    return gShell.call("network_getContentLength", {url: new URL(update.archivePath, `${UPDATE_SOURCE_URL_BASE}/`).href}).then(function(size) {
        archiveSize = size;

        return getPackagesToDownloadForUpdate(update);
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
    privilegedInterface.setData("updates_updateStatus", status);
    privilegedInterface.setData("updates_updateProgress", progress);
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
                vernum: update.vernum,
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
            currentUpdateAbortControllerId
        }).catch(makeError("GOS_UPDATE_FAIL_PKG_LIST")).then(dummyDelay);
    }).then(function() {
        return getEstimatedUpdateDownloadSize(update);
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
        if (update.preinstallScriptPath) {
            return gShell.call("storage_getPath", {location: `update/${update.preinstallScriptPath}`}).then(function(path) {
                return gShell.call("system_executeCommand", {
                    command: path,
                    options: {
                        env: getEnvironmentVariables(update, true)
                    }
                });
            }).catch(makeError("GOS_UPDATE_FAIL_PREINSTALL_SCRIPT"));
        }

        return Promise.resolve();
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
            })
        });

        return promiseChain;
    }).then(function() {
        setUpdateProgress("installing", null);

        if (update.postinstallScriptPath) {
            return gShell.call("storage_getPath", {location: `update/${update.postinstallScriptPath}`}).then(function(path) {
                return gShell.call("system_executeCommand", {
                    command: path,
                    options: {
                        env: getEnvironmentVariables(update, true)
                    }
                });
            }).catch(makeError("GOS_UPDATE_FAIL_POSTINSTALL_SCRIPT"));
        }

        return Promise.resolve();
    }).then(function() {
        if (update.rebootScriptPath) {
            return gShell.call("storage_getPath", {location: `update/${update.rebootScriptPath}`}).then(function(path) {
                return gShell.call("system_executeCommand", {
                    command: "cp",
                    args: [path, "/system/scripts/update-reboot.sh"],
                    options: {
                        env: getEnvironmentVariables(update, true)
                    }
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
        // TODO: Delete archive extract location after startup staging is complete

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
        setUpdateProgress("readyToRestart");

        return Promise.resolve();
    }).catch(function(error) {
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

        // TODO: Add client-side error reporting in Settings app with stability info dependent on retrospective ability to cancel

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
    // TODO: Check update history log and mark any pending updates as failed

    return config.read("updates.gsc").then(function(data) {
        // TODO: Allow advanced users to change update circuit

        updateCircuit = data.updateCircuit || "alpha"; // TODO: Change when we make our first Beta or Main releases
        shouldAutoCheckForUpdates = !!data.shouldAutoCheckForUpdates;

        privilegedInterface.setData("updates_shouldAutoCheckForUpdates", shouldAutoCheckForUpdates);

        return Promise.resolve();
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

export function init() {
    gShell.call("system_getFlags").then(function(result) {
        flags = result;

        setUpdateProgress("notStarted");

        startUpdateCheckTimer();

        if (shouldAutoCheckForUpdates) {
            getUpdates();
        }
    });
}