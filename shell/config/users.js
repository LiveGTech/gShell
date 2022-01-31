/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as config from "gshell://config/config.js";

export class User {
    constructor(uid, data) {
        this.uid = uid;
        this.displayName = data?.displayName;
    }

    getAuthData() {
        return config.read(`users/${this.uid}/auth.gsc`);
    }

    setAuthData(data) {
        return config.write(`users/${this.uid}/auth.gsc`, data);
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

export function create(uid) {
    var userToCreate = new User(uid, {});

    return config.edit("users.gsc", function(data) {
        data.users ||= {};
        data.users[uid] = {};

        return Promise.resolve(data);
    }).then(function() {
        return userToCreate;
    });
}