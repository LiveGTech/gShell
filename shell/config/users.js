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

export const RE_LINUX_USERNAME = /^[a-zA-Z][a-zA-Z0-9-_]*\$?$/;

export class User {
    constructor(uid, data) {
        this.uid = uid;
        this.displayName = data?.displayName;
        this.permissionLevel = data?.permissionLevel;
        this.linuxUsername = data?.linuxUsername;

        this.history = data?.history || [
            {eventType: "created", performedAt: Date.now()},
            ...(this.isAdmin ? [{eventType: "givenAdminPrivileges", performedAt: Date.now()}] : [])
        ];
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

        var potentialUsername = this.displayName
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
        const USER_FOLDER_LOCATION = `/system/storage/users/${UID}/files`;

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
                ["sudo", ["mkdir", "-p", USER_FOLDER_LOCATION]],
                ["sudo", ["ln", "-s", USER_FOLDER_LOCATION, `/home/${USERNAME}`]],
                ["sudo", ["cp", "-r", "/etc/skel/.", `/home/${USERNAME}`]],
                ["sudo", ["chown", "-R", `${USERNAME}:${USERNAME}`, `/home/${USERNAME}/.`]],
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
            return gShell.call("system_executeCommand", {
                command: "sudo",
                args: ["usermod", "-c", thisScope.displayName, USERNAME]
            }).catch(function() {
                return Promise.resolve(); // User's display name may not have changed
            });
        });
    }

    init() {
        return this.ensureLinuxUser();
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

    return user.save().then(function() {
        return Promise.resolve(user);
    });
}

export function init() {
    return getList().then(function(users) {
        var promiseChain = Promise.resolve();

        users.forEach(function(user) {
            promiseChain = promiseChain.then(function() {
                return user.init();
            });
        });

        return promiseChain;
    });
}