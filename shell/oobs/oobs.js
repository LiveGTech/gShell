/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as aui_a11y from "gshell://lib/adaptui/src/a11y.js";
import * as sizeUnits from "gshell://lib/adaptui/src/sizeunits.js";

import * as system from "gshell://system/system.js";
import * as config from "gshell://config/config.js";
import * as l10n from "gshell://config/l10n.js";
import * as updates from "gshell://system/updates.js";
import * as interaction from "gshell://system/interaction.js";
import * as a11y from "gshell://a11y/a11y.js";
import * as users from "gshell://config/users.js";
import * as auth from "gshell://auth/auth.js";
import * as input from "gshell://input/input.js";
import * as lockScreen from "gshell://auth/lockscreen.js";
import * as powerMenu from "gshell://global/powermenu.js";

var flags = {};
var installDisks = [];
var installSelectedDisk = null;

const MAX_PRIMARY_PARTITIONS = 4;
const SYSTEM_SIZE = 6 * (1_024 ** 3); // 6 GiB
const SWAP_SIZE = 8 * (1_024 ** 3); // 8 GiB
const MIN_SIZE_FOR_SWAP = 3 * SWAP_SIZE; // So maximum 1/3 swap for system

const DUMMY_LSBLK_STDOUT = `\
NAME    RO       SIZE   LABEL
sda      0 3218078720   Dummy disk
sdb      0 3218078720   
sr0      0  535822336   LiveG-OS
`;

const DUMMY_FDISK_L_STDOUT = `\
Disk /dev/sda1: 3.2 GiB, 3218078720 bytes, 6285310 sectors
Disk model: Dummy
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disklabel type: gpt
Disk identifier: 00000000-0000-0000-0000-000000000000

Device        End Sectors Type
/dev/sda1 2099198 2097152 Linux filesystem
/dev/sda2 4196350 2088960 Linux filesystem
/dev/sda3 6285310    4096 Linux swap
`;

const FDISK_ERASE_SWAP_STDIN = `\
g // Use GPT partitioning
n // New partition
p // Primary
1 // Partition number
2048 // First sector
+512M // 512 MiB for EFI/BIOS boot
t // Set type
{bootType} // Specified boot sector type
n // New partition
p // Primary
2 // Partition number
// Default first sector
-${Math.floor(SWAP_SIZE / (1_024 ** 1))}K // All space except for swap
n // New partition
p // Primary
3 // Partition number
// Default first sector
// Default last sector (fill remaining to end)
t // Change partition type
3 // Partition number
19 // Linux swap
w // Write and exit
`.replace(/ *\/\/.*$/gm, "");

const FDISK_ERASE_NOSWAP_STDIN = `\
g // Use GPT partitioning
n // New partition
p // Primary
1 // Partition number
2048 // First sector
+512M // 512 MiB for EFI/BIOS boot
t // Set type
{bootType} // Specified boot sector type
n // New partition
p // Primary
2 // Partition number
// Default first sector
// All space
w // Write and exit
`.replace(/ *\/\/.*$/gm, "");

const FDISK_NEW_STDIN = `\
g // Use GPT partitioning
n // New partition
p // Primary
1 // Partition number
2048 // First sector
+512M // 512 MiB for EFI/BIOS boot
t // Set type
{bootType} // Specified boot sector type
n // New partition
p // Primary
2 // Partition number
// Next sector
+{size}M // Specified space
w // Write and exit
`.replace(/ *\/\/.*$/gm, "");

const FDISK_NEW_EXISTING_STDIN = `\
n // New partition
p // Primary
// Next partition number
// Next sector
+{size}M // Specified space
Y // Force removal of EXT4 signature
w // Write and exit
`.replace(/ *\/\/.*$/gm, "");

export function selectStep(stepName) {
    return $g.sel(`#oobs .oobs_step:not([aui-template="gshell://oobs/${stepName}.html"])`).fadeOut().then(function() {
        var step = $g.sel(`#oobs .oobs_step[aui-template="gshell://oobs/${stepName}.html"]`);

        step.find(".oobs_systemOptions").clear().add(
            $g.create("button")
                .setAttribute("title", _("oobs_powerOptions"))
                .setAttribute("aria-label", _("oobs_powerOptions"))
                .condition(step.find("div").hasAttribute("oobs-processing"), (element) => element.setAttribute("disabled", true))
                .on("click", function() {
                    powerMenu.open();
                })
                .add(
                    $g.create("img")
                        .setAttribute("src", "gshell://lib/adaptui/icons/power.svg")
                        .setAttribute("alt", "")
                        .setAttribute("aui-icon", "dark embedded")
                )
            ,
            $g.create("button")
                .setAttribute("title", _("oobs_a11yOptions"))
                .setAttribute("aria-label", _("oobs_a11yOptions"))
                .on("click", function() {
                    a11y.openMenu();
                })
                .add(
                    $g.create("img")
                        .setAttribute("src", "gshell://lib/adaptui/icons/a11y.svg")
                        .setAttribute("alt", "")
                        .setAttribute("aui-icon", "dark embedded")
                )
        );

        return step.fadeIn();
    }).then(function() {
        $g.sel($g.sel(`#oobs .oobs_step:not([hidden])`)
            .find(aui_a11y.FOCUSABLES)
            .where(":scope:not(.oobs_systemOptions *)")
            .getAll()[0]
        ).focus();

        $g.sel(`#oobs .oobs_step:not([aui-template="gshell://oobs/${stepName}.html"]) video`).getAll().forEach((element) => element.currentTime = 0);

        $g.sel(`#oobs .oobs_step:not([hidden]) video`).get()?.play();

        return Promise.resolve();
    });
}

export function finish() {
    var credentials;

    $g.sel("#oobs").fadeOut(1_000).then(function() {
        return config.write("l10n.gsc", {
            localeCode: l10n.currentLocale.localeCode
        });
    }).then(function() {
        return updates.setShouldAutoCheckForUpdates($g.sel("#oobs_interaction_checkForUpdates").getValue());
    }).then(function() {
        return interaction.setOption("researchTelemetryEnabled", $g.sel("#oobs_interaction_researchTelemetry").getValue());
    }).then(function() {
        return interaction.setOption("notifyResearchChanges", $g.sel("#oobs_interaction_researchTelemetry_notifyChanges").getValue());
    }).then(function() {
        return input.saveKeyboardLayoutsToConfig();
    }).then(function() {
        return users.create(undefined, {
            displayName: $g.sel("#oobs_userProfile_displayName").getValue().trim(),
            isAdmin: true
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

function updateKeyboardLayoutsList(language, preferredLayoutLocaleCode = $g.sel("#oobs_l10n_localeVariation").getValue()) {
    return Promise.all(Object.keys(language.locales).map((localeCode) => input.getKeyboardLayoutDataForLocale(localeCode))).then(function(data) {
        var layouts = data.flat();

        $g.sel("#oobs_l10n_keyboardLayout").clear().add(
            ...layouts.map((layout) => $g.create("option")
                .setAttribute("value", layout.path)
                .setText(layout.layout.metadata.variantName)
            )
        );

        var selectedPreferredLayout = false;

        layouts.forEach(function(layout) {
            if (selectedPreferredLayout) {
                return;
            }

            if (layout.layout.localeCode == preferredLayoutLocaleCode) {
                $g.sel("#oobs_l10n_keyboardLayout").setValue(layout.path);

                selectedPreferredLayout = true;
            }
        })

        function setKeyboardLayout() {
            input.clearKeyboardLayouts();
            input.loadKeyboardLayout($g.sel("#oobs_l10n_keyboardLayout").getValue());
        }

        $g.sel("#oobs_l10n_keyboardLayout").on("change", function() {
            setKeyboardLayout();
        });

        setKeyboardLayout();
    });
}

function getSelectedDiskInfo() {
    return installDisks.find((disk) => disk.name == installSelectedDisk) || null;
}

function checkInstallDisk() {
    if (!$g.sel("[name='oobs_installDisks']:checked").exists()) {
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
                valid: line.endsWith(" Linux filesystem")
            };
        });

        disk.endSpaceSize = (
            disk.partitions.length == 0 ?
            disk.size - (2_048 * sectorSize) :
            disk.size - disk.partitions[disk.partitions.length - 1].end
        );

        var endSpaceSizeMiB = Math.max(Math.floor(disk.endSpaceSize / (1_024 ** 2)) - 1, 0);

        $g.sel("#oobs_partitionMode_new_size").setAttribute("max", endSpaceSizeMiB);
        $g.sel("#oobs_partitionMode_new_size").setValue(endSpaceSizeMiB);

        $g.sel("#oobs_partitionMode_existing_partition").clear().add(
            ...disk.partitions.filter((partition) => partition.valid).map((partition) => $g.create("option")
                .setText(_("oobs_installPartition_existing_partition", {
                    name: partition.name,
                    size: sizeUnits.getString(Number(partition.size), _, "iec")
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
            if (getSelectedDiskInfo().size < SYSTEM_SIZE) {
                enoughSpace = false;
            }

            break;

        case "existing":
            var partitionName = $g.sel("#oobs_partitionMode_existing_partition").getValue();

            if (getSelectedDiskInfo().partitions.find((partition) => partition.name == partitionName).size < SYSTEM_SIZE) {
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

            if (newSize < SYSTEM_SIZE) {
                enoughSpace = false;
            }

            break;

        default:
            console.error("No choice for partition mode was made");

            return;
    }

    if (!enoughSpace) {
        $g.sel(".oobs_installPartition_error").setText(_("oobs_installPartition_notEnoughSpaceError", {
            sizeMetric: sizeUnits.getString(SYSTEM_SIZE, _, "metric"),
            sizeIec: sizeUnits.getString(SYSTEM_SIZE, _, "iec")
        }));

        return;
    }

    $g.sel(".oobs_installPartition_error").setText("");

    selectStep("installconfirm");
}

function makeError(code) {
    return function(error) {
        console.error(error);

        if (String(error).startsWith("GOS_OOBS_")) {
            return Promise.reject(error);
        }

        return Promise.reject(code);
    }
}

function getPartitionName(diskName, partitionNumber) {
    if (diskName.startsWith("nvme")) {
        return `${diskName}p${partitionNumber}`;
    }

    return `${diskName}${partitionNumber}`;
}

function processInstallation() {
    var partitionMode = $g.sel("[name='oobs_partitionMode']:checked").getAttribute("value");
    var partitionName = null;
    var systemUsesEfi = true;
    var shouldFormatEfi = true;

    return gShell.call("storage_exists", {
        location: "/sys/firmware/efi"
    }).then(function(result) {
        systemUsesEfi = result;
        shouldFormatEfi = systemUsesEfi;

        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mkdir", "-p", "/tmp/base", "/boot/efi"]
        }).catch(makeError("GOS_OOBS_FAIL_CREATE_MOUNT_POINT"));
    }).then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_partitioning"));
        $g.sel(".oobs_installProcess_progress").removeAttribute("value");

        selectStep("installprocess");

        if (partitionMode == "erase") {
            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["sfdisk", "--delete", `/dev/${installSelectedDisk}`]
            }).catch(function() {
                // Ignore since `sfdisk` returns exit code `1` if empty to begin with
                return Promise.resolve();
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["fdisk", `/dev/${installSelectedDisk}`],
                    stdin: (getSelectedDiskInfo().size >= MIN_SIZE_FOR_SWAP ? FDISK_ERASE_SWAP_STDIN : FDISK_ERASE_NOSWAP_STDIN)
                        .replace(/{bootType}/g, systemUsesEfi ? "1" : "4")
                });
            }).catch(makeError("GOS_OOBS_FAIL_PARTITION_DISK_ERASE")).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["fdisk", "-l", "-o", "Device,Type", `/dev/${installSelectedDisk}`] // TODO: Use `Device,Id` instead to match filesystem type IDs instead of names
                });
            }).catch(makeError("GOS_OOBS_FAIL_LIST_PARTITIONS_ERASE")).then(function(output) {
                if (!flags.isRealHardware) {
                    partitionName = "sda1";

                    return dummyDelay();
                }

                var partitions = output.stdout
                    .split("\n")
                    .filter((line) => line.startsWith("/dev/") && line.endsWith(" Linux filesystem"))
                    .map((line) => line.match(/^\/dev\/([^\s]+)/)[1])
                ;

                if (partitions.length == 0) {
                    return Promise.reject("GOS_OOBS_TRAP_NO_PARTITIONS_FOUND");
                }

                partitionName = partitions[0];

                return Promise.resolve();
            });
        }

        if (partitionMode == "existing") {
            partitionName = $g.sel("#oobs_partitionMode_existing_partition").getValue();
            shouldFormatEfi = false;

            return Promise.resolve();
        }

        if (partitionMode == "new") {
            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["fdisk", "-l", "-o", "Device,Type", `/dev/${installSelectedDisk}`]
            }).catch(makeError("GOS_OOBS_FAIL_LIST_PARTITIONS_NEW_BEFORE_WRITE")).then(function(output) {
                var hasEfiPartitions = false;

                if (flags.isRealHardware) {
                    var allPartitions = output.stdout
                        .split("\n")
                        .filter((line) => line.startsWith("/dev/"))
                        .map((line) => line.match(/^\/dev\/([^\s]+)/)[1])
                    ;

                    var efiPartitions = output.stdout
                        .split("\n")
                        .filter((line) => line.startsWith("/dev/") && line.endsWith(" EFI System"))
                        .map((line) => line.match(/^\/dev\/([^\s]+)/)[1])
                    ;

                    if (efiPartitions.length > 0) {
                        hasEfiPartitions = true;
                        shouldFormatEfi = false;

                        if (efiPartitions[0] != getPartitionName(installSelectedDisk, 1)) {
                            return Promise.reject("GOS_OOBS_TRAP_EFI_NOT_AT_START");
                        }
                    }

                    if (allPartitions.length > 0 && efiPartitions.length == 0) {
                        return Promise.reject("GOS_OOBS_TRAP_NO_EFI_PARTITION");
                    }
                }

                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["fdisk", `/dev/${installSelectedDisk}`],
                    stdin: (hasEfiPartitions ? FDISK_NEW_EXISTING_STDIN : FDISK_NEW_STDIN)
                        .replace(/{bootType}/g, systemUsesEfi ? "1" : "4")
                        .replace(/{size}/g, String(Number($g.sel("#oobs_partitionMode_new_size").getValue()) || 0))
                }).catch(makeError("GOS_OOBS_FAIL_PARTITION_DISK_NEW"));
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["fdisk", "-l", "-o", "Device,Type", `/dev/${installSelectedDisk}`]
                }).catch(makeError("GOS_OOBS_FAIL_LIST_PARTITIONS_NEW"));
            }).then(function(output) {
                if (!flags.isRealHardware) {
                    partitionName = "sda1";

                    return dummyDelay();
                }

                var partitions = output.stdout
                    .split("\n")
                    .filter((line) => line.startsWith("/dev/") && line.endsWith(" Linux filesystem"))
                    .map((line) => line.match(/^\/dev\/([^\s]+)/)[1])
                ;

                if (partitions.length == 0) {
                    return Promise.reject("GOS_OOBS_TRAP_NO_PARTITIONS_FOUND");
                }

                if (getSelectedDiskInfo().partitions.map((partition) => partition.name).includes(partitions[partitions.length - 1])) {
                    return Promise.reject("GOS_OOBS_TRAP_NO_NEW_PARTITION");
                }

                partitionName = partitions[partitions.length - 1];

                return Promise.resolve();
            });
        }

        return Promise.reject("GOS_OOBS_IMPL_BAD_PARTITION_CHOICE");
    }).then(function() {
        // Try unmounting (partition may still be mounted if retrying)
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["umount", `/dev/${partitionName}`]
        }).catch(function() {
            // Wasn't mounted in first place
            return Promise.resolve();
        });
    }).then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_formatting"));

        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mkfs.ext4", `/dev/${partitionName}`, "-L", "LiveG-OS"]
        }).catch(makeError("GOS_OOBS_FAIL_FORMAT_PARTITION")).then(dummyDelay);
    }).then(function() {
        if (!shouldFormatEfi) {
            return Promise.resolve();
        }

        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mkfs.fat", "-F", "32", `/dev/${getPartitionName(installSelectedDisk, 1)}`]
        }).catch(makeError("GOS_OOBS_FAIL_FORMAT_EFI"));
    }).then(function() {
        if (partitionMode != "erase" || getSelectedDiskInfo().size < MIN_SIZE_FOR_SWAP) {
            return Promise.resolve();
        }

        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mkswap", `/dev/${getPartitionName(installSelectedDisk, 3)}`, "-L", "LiveG-Swap"]
        }).catch(makeError("GOS_OOBS_FAIL_LABEL_SWAP"));
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mount", `/dev/${partitionName}`, "/tmp/base"]
        }).catch(makeError("GOS_OOBS_FAIL_MOUNT_PARTITION"));
    }).then(function() {
        if (!systemUsesEfi) {
            return Promise.resolve();
        }

        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["mount", `/dev/${getPartitionName(installSelectedDisk, 1)}`, "/boot/efi"]
        }).catch(makeError("GOS_OOBS_FAIL_MOUNT_EFI"));
    }).then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_copying"));

        if (!flags.isRealHardware) {
            return dummyDelay();
        }

        return gShell.call("system_copyFiles", {
            source: "/ro/",
            destination: "/tmp/base",
            exclude: ["/dev", "/proc", "/sys", "/tmp", "/mnt"],
            privileged: true
        }).catch(makeError("GOS_OOBS_FAIL_START_COPY_FILES")).then(function(id) {
            return new Promise(function(resolve, reject) {
                (function poll() {
                    gShell.call("system_getCopyFileInfo", {id}).then(function(info) {
                        if (info.progress > 0) {
                            $g.sel(".oobs_installProcess_progress").setValue(info.progress);
                            $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_copyingProgress", {progress: Math.round(info.progress * 100)}));
                        }

                        switch (info.status) {
                            case "running":
                                requestAnimationFrame(poll);
                                break;

                            case "success":
                                resolve();
                                break;

                            case "error":
                                reject("GOS_OOBS_FAIL_COPY_FILES");
                                break;

                            default:
                                reject("GOS_OOBS_IMPL_BAD_COPY_STATUS");
                                break;
                        }
                    });
                })();
            });
        });
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["cp", "/system/install/grub.cfg", "/tmp/base/boot/grub/grub.cfg"]
        }).catch(makeError("GOS_OOBS_FAIL_COPY_BOOTLOADER"));
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["cp", (
                partitionMode == "erase" && getSelectedDiskInfo().size >= MIN_SIZE_FOR_SWAP ?
                "/system/install/fstab-swap" :
                "/system/install/fstab"
            ), "/tmp/base/etc/fstab"]
        }).catch(makeError("GOS_OOBS_FAIL_COPY_FSTAB"));
    }).then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_installingBootloader"));
        $g.sel(".oobs_installProcess_progress").removeAttribute("value");

        var promiseChain = Promise.resolve();

        ["/tmp/base/dev", "/tmp/base/proc", "/tmp/base/sys"].forEach(function(path) {
            promiseChain = promiseChain.then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["mkdir", path]
                });
            });
        });

        ["dev", "proc", "sys", "usr"].forEach(function(path) {
            promiseChain = promiseChain.then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["mount", "--bind", `/${path}`, `/tmp/base/${path}`]
                });
            });
        });

        return promiseChain;
    }).then(function() {
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["chroot", "/tmp/base", "/bin/bash", "-c",
                (
                    systemUsesEfi ? (
                        `mkdir -p /boot/efi;` +
                        `mount /dev/${getPartitionName(installSelectedDisk, 1)} /boot/efi;`
                    ) : ""
                ) +
                `grub-install /dev/${installSelectedDisk} --removable`
            ]
        }).catch(makeError("GOS_OOBS_FAIL_INSTALL_BOOTLOADER")).then(dummyDelay);
    }).then(function() {
        $g.sel(".oobs_installProcess_status").setText(_("oobs_installProcess_status_finalising"));
        
        return gShell.call("system_executeCommand", {
            command: "sudo",
            args: ["umount", "-l", "/tmp/base"]
        }).catch(makeError("GOS_OOBS_FAIL_UNMOUNT_DISK")).then(dummyDelay);
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

    gShell.call("system_isInstallationMedia").then(function(isInstallationMedia) {
        selectStep(isInstallationMedia ? "finish" : "interaction");
    });
}

export function init() {
    fetch("gshell://oobs/l10n.json").then(function(response) {
        return response.json();
    }).then(function(data) {
        var i = 0;
        var pastFirst = false;

        function nextMessage() {
            $g.sel(".oobs_welcome_message").addClass("transitioning");

            setTimeout(function() {
                $g.sel(".oobs_welcome_title").setText(data.messages[i].title);
                $g.sel(".oobs_welcome_description").setText(data.messages[i].description);

                $g.sel(".oobs_welcome_title, .oobs_welcome_description").setAttribute("dir", data.messages[i].textDirection);

                $g.sel(".oobs_welcome_message").removeClass("transitioning");

                if (!pastFirst) {
                    data.messages = data.messages
                        .map((message, i) => ({...message, i, position: Math.random()}))
                        .sort((a, b) => a.position - b.position)
                    ;

                    if (data.messages[0].i == 0) {
                        i = 1;
                    }

                    pastFirst = true;

                    return;
                }

                i++;

                if (i >= data.messages.length) {
                    i = 0;
                }
            }, 500);
        }

        setInterval(nextMessage, 3_000);

        nextMessage();

        $g.sel(".oobs_languages").clear().add(
            ...data.languages.map((language) => $g.create("button")
                .setAttribute("data-locale", language.baseLocale)
                .setAttribute("aui-listitem", true)
                .setText(language.name)
                .on("click", function() {
                    l10n.apply(language.baseLocale);

                    $g.sel("#oobs_l10n_localeVariation").clear().add(
                        ...Object.keys(language.locales)
                            .filter((localeCode) => language.locales[localeCode] != null) // Locale names marked as `null` have their keyboard layouts implemented but have no locale file
                            .map((localeCode) => $g.create("option")
                                .setAttribute("value", localeCode)
                                .setText(language.locales[localeCode])
                            )
                    );

                    $g.sel("#oobs_l10n_localeVariation").setValue(language.baseLocale);

                    $g.sel("#oobs_l10n_localeVariation").on("change", function() {
                        l10n.apply($g.sel("#oobs_l10n_localeVariation").getValue());

                        updateKeyboardLayoutsList(language);
                    });

                    updateKeyboardLayoutsList(language);

                    selectStep("l10n");
                })
            )
        );

        selectStep("welcome").then(function() {
            $g.sel(".oobs_languages button[data-locale='en_GB']").focus();
        });
    });

    gShell.call("system_getFlags").then(function(result) {
        flags = result;

        return gShell.call("system_isInstallationMedia");
    }).then(function(isInstallationMedia) {
        $g.sel("button[oobs-choosestep]").forEach(function(element) {    
            element.on("click", function() {
                if (isInstallationMedia && element.hasAttribute("oobs-choosestepim")) {
                    selectStep(element.getAttribute("oobs-choosestepim"));
                } else {
                    selectStep(element.getAttribute("oobs-choosestep"));
                }
            });
        });
    });

    $g.sel(".oobs_finish").on("click", function() {
        finish();
    });

    $g.sel(".oobs_installAsk_disk").on("click", function() {
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
            }).filter((disk) => !["sr0", "fd0"].includes(disk.name) && disk.label != "LiveG-OS-IM" && !disk.readOnly);

            if (installDisks.length > 0) {
                $g.sel(".oobs_installDisks").clear().add(
                    ...installDisks.map((disk) => $g.create("div").add(
                        $g.create("input")
                            .setId(`oobs_installDisks_${disk.name}`)
                            .setAttribute("type", "radio")
                            .setAttribute("name", "oobs_installDisks")
                            .setAttribute("value", disk.name)
                            .on("change", function() {
                                $g.sel("#oobs_partitionMode_erase").setValue(true);
                                $g.sel(".oobs_partitionMode_dependency").setAttribute("inert", "dependent");
                            })
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
                                    size: sizeUnits.getString(Number(disk.size), _)
                                }))
                            )
                    ))
                );
            } else {
                $g.sel(".oobs_installDisks").clear().add(
                    $g.create("aui-message").add(
                        $g.create("h2").setText(_("oobs_installDisks_noneMessage_title")),
                        $g.create("p").setText(_("oobs_installDisks_noneMessage_description"))
                    )
                );
            }

            selectStep("installdisk");
        });
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
            selectStep("installfinish");

            var countdownValue = 10;

            $g.sel(".oobs_installFinish_countdown").setText(_format(countdownValue));

            var countdownInterval = setInterval(function() {
                countdownValue--;

                $g.sel(".oobs_installFinish_countdown").setText(_format(countdownValue));

                if (countdownValue == 0) {
                    clearInterval(countdownInterval);

                    system.restart("installationFinished");
                }
            }, 1_000);
        }).catch(function(error) {
            console.error(error);

            $g.sel(".oobs_installFail_error").setText(error || "UNKNOWN");

            selectStep("installfail");
        });
    });

    $g.sel(".oobs_installFinish_restart").on("click", function() {
        system.restart("installationFinished");
    });

    $g.sel(".oobs_userProfile_next").on("click", function() {
        checkDisplayName();
    });

    $g.sel("#oobs_userProfile_displayName").on("keydown", function(event) {
        if (event.key == "Enter") {
            checkDisplayName();
        }
    });

    $g.sel("#oobs_interaction_researchTelemetry").on("change", function() {
        if ($g.sel("#oobs_interaction_researchTelemetry").getValue()) {
            $g.sel(".oobs_interaction_researchTelemetry_dependency").removeAttribute("inert");
        } else {
            $g.sel(".oobs_interaction_researchTelemetry_dependency").setAttribute("inert", "dependent");
            $g.sel("#oobs_interaction_researchTelemetry_notifyChanges").setValue(false);
        }
    });
}