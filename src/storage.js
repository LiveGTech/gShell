/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const path = require("path");
const fs = require("fs");
const electron = require("electron");
const mkdirp = require("mkdirp");

var flags = require("./flags");

exports.systemDirectory = flags.isRealHardware ? "/system" : path.normalize(`${electron.app.getPath("home")}/gShell`);
exports.storageFilesystemLocation = path.normalize(`${exports.systemDirectory}/storage`);

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

            if (encoding == null) {
                resolve(Uint8Array.from(data));

                return;
            }

            resolve(data);
        });
    });
};

exports.write = function(location, data, encoding = "utf8", append = false) {
    return new Promise(function(resolve, reject) {
        (append ? fs.appendFile : fs.writeFile)(exports.getPath(location), data, {encoding}, function(error) {
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

exports.move = function(location, newLocation) {
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

exports.newFolder = function(location, parentOnly = false) {
    var parts = location.split("/");

    if (parentOnly) {
        parts.pop();
    }

    return new Promise(function(resolve, reject) {
        mkdirp(exports.getPath(parts.join("/")), function(error) {
            if (error) {
                reject(error);

                return;
            }

            resolve();
        });
    });
};

exports.listFolder = function(location) {
    return new Promise(function(resolve, reject) {
        fs.readdir(exports.getPath(location), function(error, data) {
            if (error) {
                reject(error);

                return;
            }

            resolve(data);
        });
    });
};

/*
    The stats returned are described here:
    https://nodejs.org/api/fs.html#fsstatpath-options-callback

    * To get the size of a file, use the `size` property of the resolved object
    * `atime` for when file was last accessed/read
    * `mtime` for when file was last modified (excluding metadata changes)
    * `ctime` for when metadata of file was last modified
*/
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