/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

/*
    Resources loaded using the `Resource` class are non-system resources that
    can contain file-based (binary) data for purposes such as caching and
    offline use.
    
    Using this resource system is recommended to prevent gShell from having to
    frequently download the same file from the internet when it needs to be
    loaded, as this wastes requests and might not work when offline.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as config from "gshell://config/config.js";

export class Resource {
    constructor(extension = null, data = new ArrayBuffer(0)) {
        this.id = $g.core.generateKey();
        this.extension = extension;
        this.data = data;
    }

    get path() {
        return `resources/${this.id}.${this.extension}`;
    }

    get url() {
        return `storage://${this.path}`;
    }

    static load(id) {
        var instance = new this();

        instance.id = id;

        return config.read("resources.gsc", function(data) {
            if (!data.resources?.[instance.id]) {
                return Promise.reject(`The resource with ID \`${instance.id}\` was not found`);
            }

            instance.extension = data.extension;

            return gShell.call("storage_read", {
                location: instance.path,
                encoding: null
            });
        }).then(function(data) {
            instance.data = data.buffer;

            return Promise.resolve(instance);
        });
    }

    save() {
        var thisScope = this;

        if (this.extension == null) {
            return Promise.reject("No extension was specified");
        }

        return gShell.call("storage_newFolder", {
            location: "resources"
        }).then(function() {
            return gShell.call("storage_write", {
                location: thisScope.path,
                encoding: null,
                data: new Uint8Array(thisScope.data)
            });
        }).then(function() {
            return config.edit("resources.gsc", function(data) {
                data.resources ||= {};

                data.resources[thisScope.id] = {
                    extension: thisScope.extension
                };

                return Promise.resolve(data);
            });
        });
    }

    remove() {
        var thisScope = this;

        return config.edit("resources.gsc", function(data) {
            data.resources ||= {};

            delete data.resources[thisScope.id];

            return Promise.resolve(data.resources);
        }).then(function() {
            return gShell.call("storage_delete", {
                location: thisScope.path
            });
        });
    }
}