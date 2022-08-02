/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as a11y from "gshell://lib/adaptui/src/a11y.js";

import * as users from "gshell://config/users.js";
import * as auth from "gshell://auth/auth.js";
import * as lockScreen from "gshell://auth/lockscreen.js";
import * as sizeUnits from "gshell://common/sizeunits.js";

var flags = {};
var systemSize = null;
var installDisks = [];
var installSelectedDisk = null;

const MAX_PRIMARY_PARTITIONS = 4;
const SWAP_SIZE = 8 * (1_024 ** 3); // 8 GiB
const MIN_SIZE_FOR_SWAP = 3 * SWAP_SIZE; // So maximum 1/3 swap for system

const DUMMY_LSBLK_STDOUT = `\
NAME    RO       SIZE   LABEL
sda      0 1073741824   Dummy disk
sdb      0 1073741824   
sr0      0  535822336   LiveG-OS
`;

const DUMMY_FDISK_L_STDOUT = `\
Disk /dev/sda1: 1 GiB, 1073741824 bytes, 2097152 sectors
Disk model: Dummy                                   
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disklabel type: dos
Disk identifier: 0x00000000

Device        End Sectors Type
/dev/sda1 1050623 1048576 Linux
/dev/sda2 2093055 1044480 Linux
/dev/sda3 2097152    4096 Linux swap / Solaris
`;

const FDISK_ERASE_SWAP_STDIN = `\
n // New partition
p // Primary
1 // Partition number
2048 // First sector
-${Math.floor(SWAP_SIZE / (1_024 ** 1))}K // All space except for swap
n // New partition
p // Primary
2 // Partition number
// Default first sector
+${Math.floor(SWAP_SIZE / (1_024 ** 1))}K // Swap size
t // Change partition type
2 // Partition number
swap // Linux swap / Solaris
w // Write and exit \
`.replace(/ *\/\/.*$/gm, "");

const FDISK_ERASE_NOSWAP_STDIN = `\
n // New partition
p // Primary
1 // Partition number
2048 // First sector
// All space
w // Write and exit \
`.replace(/ *\/\/.*$/gm, "");

const FDISK_NEW_STDIN = `\
n // New partition
p // Primary
// Next partition number
// Next sector
+{size}M // Specified space
w // Write and exit \
`;

export function selectStep(stepName) {
    return $g.sel(`#oobs .oobs_step:not([aui-template="gshell://oobs/${stepName}.html"])`).fadeOut().then(function() {
        return $g.sel(`#oobs .oobs_step[aui-template="gshell://oobs/${stepName}.html"]`).fadeIn();
    }).then(function() {
        $g.sel($g.sel(`#oobs .oobs_step:not([hidden])`).find(a11y.FOCUSABLES).getAll()[0]).focus();
    });
}

export function finish() {
    var credentials;

    $g.sel("#oobs").fadeOut(1_000).then(function() {
        return users.create(undefined, {
            displayName: $g.sel("#oobs_userProfile_displayName").getValue().trim()
        });
    }).then(function(user) {
        credentials = new auth.UserAuthCredentials(user);

        return auth.UnsecureAuthMethod.generate();
    }).then(function(method) {
        credentials.authMethods.push(method);

        return credentials.save();
    }).then(function() {
        return lockScreen.loadUsers();
    }).then(function() {
        $g.sel("#lockScreenMain").screenFade();
    });
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

function getSelectedDiskInfo() {
    return installDisks.find((disk) => disk.name == installSelectedDisk) || null;
}

function checkInstallDisk() {
    if ($g.sel("[name='oobs_installDisks']:checked").getAll().length == 0) {
        $g.sel(".oobs_installDisk_error").setText(_("oobs_installDisk_emptyError"));

        return;
    }

    $g.sel(".oobs_installDisk_error").setText("");

    installSelectedDisk = $g.sel("[name='oobs_installDisks']:checked").getAttribute("value");

    gShell.call("system_executeCommand", {
        command: "sudo",
        args: ["fdisk", "-l", "-o", "Device,End,Sectors,Type", `/dev/${installSelectedDisk}`]
    }).then(function(output) {
        var lines = (flags.isRealHardware ? output.stdout : DUMMY_FDISK_L_STDOUT).split("\n");

        var sectorSize = Number(lines.find((line) => line.startsWith("Sector size"))?.match(/([0-9]+) bytes$/)?.[1]) || 512;
        var disk = getSelectedDiskInfo();

        disk.partitions = lines.filter((line) => line.startsWith("/dev/")).map(function(line) {
            var parts = line.split(" ").filter((part) => part != "");

            return {
                name: parts[0].replace("/dev/", ""),
                size: Number(parts[2]) * sectorSize,
                end: Number(parts[1]) * sectorSize,
                valid: line.endsWith(" Linux")
            };
        });

        disk.endSpaceSize = (
            disk.partitions.length == 0 ?
            disk.size - (2_048 * sectorSize) :
            disk.size - disk.partitions[disk.partitions.length - 1].end
        );

        var endSpaceSizeMiB = Math.floor(disk.endSpaceSize / (1_024 ** 2));

        $g.sel("#oobs_partitionMode_new_size").setAttribute("max", endSpaceSizeMiB);
        $g.sel("#oobs_partitionMode_new_size").setValue(endSpaceSizeMiB);

        $g.sel("#oobs_partitionMode_existing_partition").clear().add(
            ...disk.partitions.filter((partition) => partition.valid).map((partition) => $g.create("option")
                .setText(_("oobs_installPartition_existing_partition", {
                    name: partition.name,
                    size: sizeUnits.getString(Number(partition.size), "iec")
                }))
                .setAttribute("value", partition.name)
            )
        );

        if (disk.partitions.filter((partition) => partition.valid).length == 0) {
            $g.sel(".oobs_partitionMode_existing_container").setAttribute("inert", "dependent");
            $g.sel(".oobs_partitionMode_existing_notice").setText(_("oobs_installPartition_noneExistNotice"));
        } else {
            $g.sel(".oobs_partitionMode_existing_container").removeAttribute("inert");
            $g.sel(".oobs_partitionMode_existing_notice").setText("");
        }

        if (lines.filter((line) => line.startsWith("/dev/")).length == MAX_PRIMARY_PARTITIONS) {
            $g.sel(".oobs_partitionMode_new_container").setAttribute("inert", "dependent");
            $g.sel(".oobs_partitionMode_new_notice").setText(_("oobs_installPartition_maxPrimaryReachedNotice"));
        } else {
            $g.sel(".oobs_partitionMode_new_container").removeAttribute("inert");
            $g.sel(".oobs_partitionMode_new_notice").setText("");
        }
    });

    selectStep("installpartition");
}

function checkInstallPartition() {
    var mode = $g.sel("[name='oobs_partitionMode']:checked").getAttribute("value");
    var enoughSpace = true;

    switch (mode) {
        case "erase":
            if (getSelectedDiskInfo().size < systemSize) {
                enoughSpace = false;
            }

            break;

        case "existing":
            var partitionName = $g.sel("#oobs_partitionMode_existing_partition").getValue();

            if (getSelectedDiskInfo().partitions.find((partition) => partition.name == partitionName).size < systemSize) {
                enoughSpace = false;
            }

            break;

        case "new":
            var newSizeMiB = Number($g.sel("#oobs_partitionMode_new_size").getValue()) || 0;
            var newSize = Math.floor(newSizeMiB * (1_024 ** 2));

            if (newSize > getSelectedDiskInfo().endSpaceSize) {
                newSize = getSelectedDiskInfo().endSpaceSize;
                newSizeMiB = Math.floor(newSize / (1_024 ** 2));

                $g.sel("#oobs_partitionMode_new_size").setValue(newSizeMiB);
            }

            if (newSize == 0) {
                $g.sel(".oobs_installPartition_error").setText(_("oobs_installPartition_minimumSizeError"));

                return;
            }

            if (newSize < systemSize) {
                enoughSpace = false;
            }

            break;

        default:
            console.error("No choice for partition mode was made");

            return;
    }

    if (!enoughSpace) {
        $g.sel(".oobs_installPartition_error").setText(_("oobs_installPartition_notEnoughSpaceError", {
            sizeMetric: sizeUnits.getString(systemSize, "metric"),
            sizeIec: sizeUnits.getString(systemSize, "iec")
        }));

        return;
    }

    $g.sel(".oobs_installPartition_error").setText("");

    selectStep("installconfirm");
}

function processInstallation() {
    var partitionMode = $g.sel("[name='oobs_partitionMode']:checked").getAttribute("value");
    var partitionName = null;

    selectStep("installprocess");

    return Promise.resolve().then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_partitioning"));

        if (partitionMode == "erase") {
            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["sfdisk", "--delete", `/dev/${installSelectedDisk}`]
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["fdisk", `/dev/${installSelectedDisk}`],
                    stdin: getSelectedDiskInfo().size >= MIN_SIZE_FOR_SWAP ? FDISK_ERASE_SWAP_STDIN : FDISK_ERASE_NOSWAP_STDIN
                });
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["fdisk", "-l", "-o", "Device,Type", `/dev/${installSelectedDisk}`]
                });
            }).then(function(output) {
                if (!flags.isRealHardware) {
                    partitionName = "sda1";

                    return dummyDelay();
                }

                var partitions = output.stdout
                    .split("\n")
                    .filter((line) => line.startsWith("/dev/") && line.endsWith(" Linux"))
                    .map((line) => line.match(/^\/dev\/([^\s]+)/)[1])
                ;

                if (partitions.length == 0) {
                    return Promise.reject("TRAP_NO_PARTITIONS_FOUND");
                }

                partitionName = partitions[0];

                return Promise.resolve();
            });
        }

        if (partitionMode == "existing") {
            partitionName = $g.sel("#oobs_partitionMode_existing_partition").getValue();

            return Promise.resolve();
        }

        if (partitionMode == "new") {
            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["fdisk", `/dev/${installSelectedDisk}`],
                stdin: FDISK_NEW_STDIN.replace(/{size}/g, String(Number($g.sel("#oobs_partitionMode_new_size").getValue()) || 0))
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["fdisk", "-l", "-o", "Device,Type", `/dev/${installSelectedDisk}`]
                });
            }).then(function(output) {
                if (!flags.isRealHardware) {
                    partitionName = "sda1";

                    return dummyDelay();
                }

                var partitions = output.stdout
                    .split("\n")
                    .filter((line) => line.startsWith("/dev/") && line.endsWith(" Linux"))
                    .map((line) => line.match(/^\/dev\/([^\s]+)/)[1])
                ;

                if (partitions.length == 0) {
                    return Promise.reject("TRAP_NO_PARTITIONS_FOUND");
                }

                if (getSelectedDiskInfo().partitions.map((partition) => partition.name).includes(partitions[partitions.length - 1])) {
                    return Promise.reject("TRAP_NO_NEW_PARTITION");
                }

                partitionName = partitions[partitions.length - 1];

                return Promise.resolve();
            });
        }

        return Promise.reject("No choice for partition mode was made");
    }).then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_formatting"));

        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mkfs.ext4", `/dev/${installSelectedDisk}`, "-L", "LiveG OS"]
        }).then(dummyDelay);
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mount", `/dev/${installSelectedDisk}`, "/tmp/base"]
        }).then(dummyDelay);
    }).then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_copying"));
    });
}

function checkDisplayName() {
    if ($g.sel("#oobs_userProfile_displayName").getValue().trim() == "") {
        $g.sel(".oobs_userProfile_error").setText(_("oobs_userProfile_displayNameEmptyError"));

        return;
    }

    if ($g.sel("#oobs_userProfile_displayName").getValue().trim().length > 1_000) {
        $g.sel(".oobs_userProfile_error").setText(_("oobs_userProfile_displayNameLengthError"));

        return;
    }

    $g.sel(".oobs_userProfile_error").setText("");

    selectStep("finish");
}

export function init() {
    selectStep("welcome");

    gShell.call("system_getFlags").then(function(result) {
        flags = result;

        return gShell.call("system_isInstallationMedia");
    }).then(function(isInstallationMedia) {
        $g.sel("button[oobs-choosestep]").getAll().forEach(function(element) {
            element = $g.sel(element);
    
            element.on("click", function() {
                if (isInstallationMedia && element.hasAttribute("oobs-choosestepim")) {
                    selectStep(element.getAttribute("oobs-choosestepim"));
                } else {
                    selectStep(element.getAttribute("oobs-choosestep"));
                }
            });
        });

        if (isInstallationMedia) {
            gShell.call("system_executeCommand", {
                command: "lsblk",
                args: ["-db", "-o", "NAME,RO,SIZE,LABEL"]
            }).then(function(output) {
                var lines = (flags.isRealHardware ? output.stdout : DUMMY_LSBLK_STDOUT).split("\n").filter((line) => line != "");

                lines.shift();

                installDisks = lines.map(function(line, i) {
                    var parts = line.split(" ").filter((part) => part != "");

                    return {
                        number: i + 1,
                        name: parts[0],
                        readOnly: parts[1] == 1,
                        size: Number(parts[2]),
                        label: parts.slice(3).join(" ")
                    };
                }).filter((disk) => !["sr0", "fd0"].includes(disk.name) && !disk.readOnly);

                systemSize = (lines.find((line) => line.startsWith("sr0")) || "").split(" ").filter((part) => part != "")?.[2] || null;

                $g.sel(".oobs_installDisks").clear().add(
                    ...installDisks.map((disk) => $g.create("div").add(
                        $g.create("input")
                            .setId(`oobs_installDisks_${disk.name}`)
                            .setAttribute("type", "radio")
                            .setAttribute("name", "oobs_installDisks")
                            .setAttribute("value", disk.name)
                        ,
                        $g.create("label")
                            .setAttribute("for", `oobs_installDisks_${disk.name}`)
                            .add(
                                $g.create("strong").setText(
                                    disk.label == "" ?
                                    _("oobs_installDisks_diskUnlabelledTitle", {...disk}) :
                                    _("oobs_installDisks_diskLabelledTitle", {...disk})
                                ),
                                $g.create("br"),
                                $g.create("span").setText(_("oobs_installDisks_diskTotalSize", {
                                    size: sizeUnits.getString(Number(disk.size))
                                }))
                            )
                    ))
                );
            });
        }
    });

    $g.sel(".oobs_finish").on("click", function() {
        finish();
    });

    $g.sel(".oobs_installDisk_next").on("click", function() {
        checkInstallDisk();
    });

    $g.sel(".oobs_installPartition_next").on("click", function() {
        checkInstallPartition();
    });

    $g.sel("[name='oobs_partitionMode']").on("change", function() {
        var mode = $g.sel("[name='oobs_partitionMode']:checked").getAttribute("value");

        $g.sel(".oobs_partitionMode_dependency").setAttribute("inert", "dependent");
        $g.sel(`.oobs_partitionMode_dependency[data-mode="${mode}"]`).removeAttribute("inert");
    });

    $g.sel(".oobs_installConfirm_confirm").on("click", function() {
        processInstallation().then(function() {
            // TODO: Go to next step
        }).catch(function(error) {
            $g.sel(".oobs_installFail_error").setText(error || "UNKNOWN");

            selectStep("installfail");
        });
    });

    $g.sel(".oobs_userProfile_next").on("click", function() {
        checkDisplayName();
    });

    $g.sel("#oobs_userProfile_displayName").on("keydown", function(event) {
        if (event.key == "Enter") {
            checkDisplayName();
        }
    });
}