/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as config from "gshell://config/config.js";
import * as auth from "gshell://auth/auth.js";
import * as info from "gshell://global/info.js";
import * as privilegedInterface from "gshell://userenv/privilegedinterface.js";

export const RE_LINUX_USERNAME = /^[a-zA-Z][a-zA-Z0-9-_]*\$?$/;

export class User {
    constructor(uid, data) {
        this.uid = uid;
        this.displayName = data?.displayName;
        this.permissionLevel = data?.permissionLevel;
        this.linuxUsername = data?.linuxUsername;

        if (data.isAdmin) {
            // This is for backwards compatibility from V0.2.0 where `users.gsc` will still reference `isAdmin`
            this.permissionLevel = "admin";

            this.save();
        }

        this.history = data?.history;

        if (!this.history) {
            this.history = [
                {eventType: "created", performedAt: Date.now()},
                ...(this.isAdmin ? [{eventType: "givenAdminPrivileges", performedAt: Date.now()}] : [])
            ];

            this.save();
        }
    }

    get isAdmin() {
        return this.permissionLevel == "admin";
    }

    getAuthData() {
        return config.read(`users/${this.uid}/auth.gsc`);
    }

    setAuthData(data) {
        return config.write(`users/${this.uid}/auth.gsc`, data);
    }

    addToHistory(eventType, data = {}) {
        this.history.push({
            eventType,
            ...data,
            performedAt: Date.now()
        });

        return this.save();
    }

    ensureLinuxUsername() {
        var thisScope = this;

        if (this.linuxUsername) {
            return Promise.resolve();
        }

        var potentialUsername = (this.displayName || "user")
            .toLocaleLowerCase()
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .replace(/--+/g, "-")
            .substring(0, 32)
        ;

        if (!potentialUsername.match(RE_LINUX_USERNAME)) {
            potentialUsername = "user";
        }

        var existingUsernames = [];
        var finalUsername = potentialUsername;
        var usernameSuffixCounter = 1;

        return gShell.call("system_getLinuxUsersList").then(function(usernames) {
            existingUsernames.push(...usernames);

            return getList();
        }).then(function(users) {
            existingUsernames.push(...users.map((user) => user.linuxUsername));

            existingUsernames.forEach(function(username) {
                if (finalUsername == username) {
                    usernameSuffixCounter++;

                    finalUsername = `${potentialUsername}-${usernameSuffixCounter}`;
                }
            });

            thisScope.linuxUsername = finalUsername;

            return thisScope.save();
        });
    }

    async ensureLinuxUser() {
        var thisScope = this;

        await this.ensureLinuxUsername();

        const UID = this.uid;
        const USERNAME = this.linuxUsername;

        return gShell.call("system_getLinuxUsersList").then(function(usernames) {
            if (usernames.includes(thisScope.linuxUsername)) {
                return Promise.resolve();
            }

            var promiseChain = gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["groupadd", "liveg"]
            }).catch(function() {
                return Promise.resolve(); // Group may have already been created
            });

            [
                ["sudo", ["useradd", USERNAME]],
                ["sudo", ["ln", "-s", `/system/storage/users/${UID}/files`, `/home/${USERNAME}`]],
                ["sudo", ["cp", "-r", "/etc/skel/.", `/home/${USERNAME}`]],
                ["sudo", ["usermod", "-aG", "liveg,users", USERNAME]],
                ["sudo", ["usermod", "-s", "/bin/bash", USERNAME]]
            ].forEach(function(command) {
                promiseChain = promiseChain.then(function() {
                    return gShell.call("system_executeCommand", {
                        command: command[0],
                        args: command[1]
                    });
                });
            });

            return promiseChain;
        }).then(function() {
            // Ensure that user has localised folder

            const DISPLAY_NAME = (thisScope.displayName || "").replace(/\//g, "").trim() || USERNAME;

            // TODO: Run this when a user signs in so that their user folder is always theirs (in case two users with same display name exist)

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["mkdir", "-p", `/${_("usersFolder")}`]
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["ln", "-sfn", `/system/storage/users/${UID}/files`, `/${_("usersFolder")}/${DISPLAY_NAME}`]
                });
            }).then(function() {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["chown", `${USERNAME}:${USERNAME}`, `/${_("usersFolder")}/${DISPLAY_NAME}`]
                });
            });
        }).then(function() {
            // Ensure that user permissions for user folder are set

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["chown", "-R", `${USERNAME}:${USERNAME}`, `/home/${USERNAME}`]
            });
        }).then(function() {
            // Ensure that user permissions for current files inside user folder are set

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["chown", "-R", `${USERNAME}:${USERNAME}`, `/home/${USERNAME}/.`]
            });
        }).then(function() {
            // Ensure user's directory is writeable by `system` user

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["chown", "system:system", `/system/storage/users/${UID}`]
            });
        }).then(function() {
            // Ensure that user is added to or removed from the `sudo` group

            if (!thisScope.isAdmin) {
                return gShell.call("system_executeCommand", {
                    command: "sudo",
                    args: ["gpasswd", "-d", "sudo", USERNAME]
                }).catch(function() {
                    return Promise.resolve(); // User may have already been removed from group
                });
            }

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["usermod", "-aG", "sudo", USERNAME]
            });
        }).then(function() {
            // Set the user's password
            // TODO: All user passwords are currently empty; we should set the user's password based on auth settings

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["usermod", "-p", "", USERNAME]
            });
        }).then(function() {
            // Sync user's display name

            if (!thisScope.displayName) {
                return Promise.resolve();
            }

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["usermod", "-c", thisScope.displayName, USERNAME]
            }).catch(function() {
                return Promise.resolve(); // User's display name may not have changed
            });
        }).then(function() {
            // Give user the Xorg auth cookie

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["cp", "/system/.Xauthority", `/home/${USERNAME}/.Xauthority`]
            });
        }).then(function() {
            // Make the user own the Xorg auth cookie

            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["chown", `${USERNAME}:${USERNAME}`, `/home/${USERNAME}/.Xauthority`]
            });
        });
    }

    init() {
        var thisScope = this;

        // Ensure that user's `files` folder exists
        return gShell.call("storage_newFolder", {
            location: `users/${this.uid}/files`
        }).then(function() {
            return thisScope.ensureLinuxUser();
        });
    }

    save() {
        var thisScope = this;

        return config.edit("users.gsc", function(allData) {
            allData.users ||= {};

            allData.users[thisScope.uid] = {
                displayName: thisScope.displayName,
                linuxUsername: thisScope.linuxUsername,
                permissionLevel: thisScope.permissionLevel,
                history: thisScope.history
            };

            return Promise.resolve(allData);
        }).then(function() {
            userDataChangeCallback();

            info.applyCurrentUser();

            return Promise.resolve();
        });
    }
}

export function get(uid) {
    return config.read("users.gsc").then(function(data) {
        if (Object.keys(data.users || {}).includes(uid)) {
            return Promise.resolve(new User(uid, data.users[uid]));
        }

        return Promise.reject(`User with UID ${uid} not found`);
    })
}

export function getList() {
    return config.read("users.gsc").then(function(data) {
        return Promise.resolve(Object.keys(data.users || {}).map(function(uid) {
            return new User(uid, data.users[uid]);
        }));
    });
}

export function getCurrentUser() {
    return Promise.resolve(auth.currentUserAuthCredentials?.user || null);
}

export function ensureCurrentUser() {
    if (auth.currentUserAuthCredentials?.user) {
        return Promise.resolve(auth.currentUserAuthCredentials.user);
    }

    return Promise.reject("No user is signed in");
}

export function onUserStateChange(callback) {
    auth.onUserStateChange(function(signedIn) {
        if (!signedIn) {
            callback(null);

            return;
        }

        getCurrentUser().then(function(user) {
            callback(user);
        });
    });
}

export function create(uid = $g.core.generateKey(), data = {}) {
    var user = new User(uid, data);

    return user.init().then(function() {
        return user.save();
    }).then(function() {
        return Promise.resolve(user);
    });
}

export function init() {
    // TODO: Write current LiveG OS version to /etc/os-release

    return gShell.call("system_executeCommand", {
        command: "sudo",
        args: ["chmod", "a+rx", "/system"]
    }).then(function() {
        return getList();
    }).then(function(users) {
        var promiseChain = Promise.resolve();

        users.forEach(function(user) {
            promiseChain = promiseChain.then(function() {
                return user.init();
            });
        });

        userDataChangeCallback();

        onUserStateChange(userDataChangeCallback);

        return promiseChain;
    });
}

function userDataChangeCallback() {
    return config.read("users.gsc").then(function(data) {
        // Don't include user history as it may be a lot of data
        Object.keys(data.users || {}).forEach(function(uid) {
            delete data.users[uid].history;
        });

        privilegedInterface.setData("users_data", data);

        return getCurrentUser();
    }).then(function(user) {
        privilegedInterface.setData("users_currentUserId", user?.uid || null);
    });
}