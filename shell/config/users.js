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

export class User {
    constructor(uid, data) {
        this.uid = uid;
        this.displayName = data?.displayName;
        this.isAdmin = data?.isAdmin;

        this.history = data?.history || [
            {eventType: "created", performedAt: Date.now()},
            ...(this.isAdmin ? [{eventType: "givenAdminPrivileges", performedAt: Date.now()}] : [])
        ];
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

    save() {
        var thisScope = this;

        return config.edit("users.gsc", function(allData) {
            allData.users ||= {};

            allData.users[thisScope.uid] = {
                displayName: thisScope.displayName,
                isAdmin: thisScope.isAdmin,
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