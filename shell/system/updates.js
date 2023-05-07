/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as openpgp from "gshell://lib/openpgp.min.mjs";

import * as about from "gshell://about.js";
import * as device from "gshell://system/device.js";
import * as config from "gshell://config/config.js";
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

var flags = {};

function filterConditions(update, items) {
    return items.filter(function(item) {
        if (!item.condition) {
            return true;
        }

        var vars = {
            platform: device.data?.platform,
            modelCodename: device.data?.model?.codename,
            vernum: update.vernum,
            version: update.version,
            oldVernum: about.VERNUM,
            oldVersion: about.VERSION
        };

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

    return fetch(new URL(update.archivePath, `${UPDATE_SOURCE_URL_BASE}/`)).then(function(response) {
        archiveSize = Number(response.headers.get("Content-Length"));

        return getPackagesToDownloadForUpdate(update);
    }).then(function(packages) {
        archiveSize += packages
            .map((updatePackage) => updatePackage.downloadSize)
            .reduce((accumulator, value) => accumulator + value, 0)
        ;

        return Promise.resolve(archiveSize);
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
    }).then(function(size) {
        if (bestUpdate != null) {
            bestUpdate.estimatedDownloadSize = size;
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

    var packageNames = filterConditions(update, update.packages).map((updatePackage) => `${updatePackage.name}=${updatePackage.version}`);

    updateInProgress = true;
    canCancelUpdate = true;

    privilegedInterface.setData("updates_updateInProgress", updateInProgress);
    privilegedInterface.setData("updates_canCancelUpdate", canCancelUpdate);

    // TODO: Download update file before commencing package downloading

    setUpdateProgress("updatingDownloadSources");

    return gShell.call("system_executeCommand", {
        command: "sudo",
        args: ["apt-get", "update"]
    }).catch(makeError("GOS_UPDATE_FAIL_PKG_LIST")).then(dummyDelay).then(function() {
        setUpdateProgress("downloading", 0);

        // TODO: Include downloading of update archive

        return gShell.call("system_aptInstallPackages", {
            packageNames,
            downloadOnly: true
        }).then(dummyDelay);
    }).then(function(id) {
        if (!flags.isRealHardware) {
            return dummyDelay();
        }

        return new Promise(function(resolve, reject) {
            (function poll() {
                gShell.call("system_getAptInstallationInfo", {id}).then(function(info) {
                    setUpdateProgress("downloading", info.progress);

                    switch (info.status) {
                        case "running":
                            setTimeout(poll);
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
        // Point of no return: cannot cancel update from this point onwards

        canCancelUpdate = false;

        privilegedInterface.setData("updates_canCancelUpdate", canCancelUpdate);

        // TODO: Run pre-install script

        setUpdateProgress("installing", 0);

        return gShell.call("system_aptInstallPackages", {packageNames}).then(dummyDelay);
    }).then(function(id) {
        if (!flags.isRealHardware) {
            return dummyDelay();
        }

        return new Promise(function(resolve, reject) {
            (function poll() {
                gShell.call("system_getAptInstallationInfo", {id}).then(function(info) {
                    setUpdateProgress("installing", info.progress);

                    switch (info.status) {
                        case "running":
                            setTimeout(poll);
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
        // TODO: Run post-install script and copy gShell AppImage to staged location before rebooting

        setUpdateProgress("readyToRestart");

        return Promise.resolve();
    }).catch(function(error) {
        updateInProgress = false;
        canCancelUpdate = true;

        privilegedInterface.setData("updates_updateInProgress", updateInProgress);
        privilegedInterface.setData("updates_canCancelUpdate", canCancelUpdate);

        return Promise.reject(error);
    });
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