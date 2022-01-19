/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

var storage = require("./storage");

exports.read = function(location) {
    return storage.exists(location).then(function(exists) {
        if (!exists) {
            return Promise.resolve({});
        }

        return storage.read(location).then(function(data) {
            try {
                return Promise.resolve(JSON.parse(data));
            } catch (e) {
                console.warn(`Could not parse config at location: ${location}`);

                return Promise.resolve({});
            }
        });
    });
};

exports.write = function(location, data) {
    return storage.newFolder(location, true).then(function() {
        return storage.write(location, JSON.stringify(data));
    });
};

exports.edit = function(location, callback) {
    return exports.read(location).then(function(data) {
        return callback(data);
    }).then(function(newData) {
        return exports.write(location, newData);
    });
};