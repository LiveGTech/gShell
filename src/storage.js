/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const path = require("path");
const electron = require("electron");
const mkdirp = require("mkdirp");

var flags = require("./flags");

exports.storageFilesystemLocation = flags.isRealHardware ? "/system/storage" : path.normalize(`${electron.app.getPath("home")}/gShell/storage`);

exports.getPath = function(location) {
    var absolutePath = path.normalize(`${exports.storageFilesystemLocation}/${location}`);

    if (!absolutePath.startsWith(exports.storageFilesystemLocation)) {
        return exports.storageFilesystemLocation;
    }

    return absolutePath;
};

exports.init = function() {
    electron.protocol.registerFileProtocol("storage", function(request, callback) {
        var url = request.url.substring("storage://".length);
    
        callback({path: exports.getPath(url)});
    });

    // TODO: Implement `file:///` protocol for per-user file access

    return new Promise(function(resolve, reject) {
        mkdirp(exports.storageFilesystemLocation, function(error) {
            if (error) {
                reject(error);

                return;
            }

            console.log(`Storage filesystem location: ${exports.storageFilesystemLocation}`);

            resolve();

            return;
        });
    });
};

exports.read = function(location, encoding = "utf8") {
    return new Promise(function(resolve, reject) {
        fs.readFile(exports.getPath(location), {encoding}, function(error, data) {
            if (error) {
                reject(error);

                return;
            }

            resolve(data);
        });
    });
};

exports.write = function(location, data, encoding = "utf8") {
    return new Promise(function(resolve, reject) {
        fs.writeFile(exports.getPath(location), data, {encoding}, function(error) {
            if (error) {
                reject(error);

                return;
            }

            resolve();
        });
    });
};

exports.delete = function(location) {
    return new Promise(function(resolve, reject) {
        fs.rm(exports.getPath(location), {force: true, recursive: true}, function(error) {
            if (error) {
                reject(error);

                return;
            }

            resolve();
        });
    });
};

exports.rename = function(location, newLocation) {
    return new Promise(function(resolve, reject) {
        fs.rename(exports.getPath(location), exports.getPath(newLocation), function(error) {
            if (error) {
                reject(error);

                return;
            }

            resolve();
        });
    });
};

exports.newFolder = function(location) {
    return new Promise(function(resolve, reject) {
        mkdirp(exports.getPath(location), function(error) {
            if (error) {
                reject(error);

                return;
            }

            resolve();
        });
    });
};

exports.stat = function(location) {
    return new Promise(function(resolve, reject) {
        fs.stat(exports.getPath(location), function(error, stats) {
            if (error) {
                reject(error);

                return;
            }

            resolve(stats);
        })
    });
};

exports.exists = function(location) {
    return Promise.resolve(fs.existsSync(exports.getPath(location)));
};