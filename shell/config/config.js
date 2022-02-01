/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export function read(location) {
    return gShell.call("config_read", {location});
}

export function write(location, data) {
    return gShell.call("config_write", {location, data});
}

export function edit(location, callback) {
    return read(location).then(function(data) {
        return callback(data);
    }).then(function(newData) {
        return write(location, newData);
    });
}