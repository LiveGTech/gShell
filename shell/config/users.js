/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";

export class User {
    constructor(uid, displayName) {
        this.uid = uid;
        this.displayName = displayName;
    }

    getAuthData() {
        return config.read(`storage://users/${this.uid}/auth.gsc`);
    }
}

export function get(uid) {
    return config.read("storage://users.gsc").then(function(data) {
        if (Object.keys(data.users || {}).includes(uid)) {
            return Promise.resolve(new User(uid, data.users[uid].displayName));
        }

        return Promise.reject(`User with UID ${uid} not found`);
    })
}

export function getList() {
    return config.read("storage://users.gsc").then(function(data) {
        return Promise.resolve(Object.keys(data.users || {}).map(function(uid) {
            var userData = data.users[uid];

            return new User(uid, userData.displayName);
        }));
    });
}