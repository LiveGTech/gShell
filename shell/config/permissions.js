/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";

import * as config from "gshell://config/config.js";
import * as users from "gshell://config/users.js";
import * as webviewManager from "gshell://userenv/webviewmanager.js";
import * as displays from "gshell://system/displays.js";
import * as switcher from "gshell://userenv/switcher.js";

/*
    These permissions ask for user input before their main action can be carried
    out (such as selecting a device to connect to). Therefore, we do not need to
    ask the user whether to allow the permission in the first place.
*/
export const PERMISSIONS_DO_NOT_ASK = ["bluetooth", "usb", "serial"];

export const DEFAULT_PERMISSIONS = {
    bluetooth: "allow",
    usb: "allow",
    serial: "allow",
    term: "ask"
};

export const PERMISSION_CONTEXTS = {
    bluetooth: {secureContextOnly: true},
    usb: {secureContextOnly: true},
    serial: {secureContextOnly: true},
    term: {secureContextOnly: true, askInAppOnly: true}
};

var pendingUsbSelectionRequests = {};
var selectUsbDeviceWebview = null;
var selectUsbDeviceFilters = null;

export function getGlobalConfig() {
    return config.read("permissions.gsc");
}

export function getUserConfig() {
    return users.getCurrentUser().then(function(user) {
        if (user == null) {
            return Promise.resolve({});
        }

        return config.read(`users/${user.uid}/permissions.gsc`);
    });
}

export function getConfigPath(global = false) {
    if (global) {
        return Promise.resolve("permissions.gsc");
    }

    return users.ensureCurrentUser().then(function(user) {
        return Promise.resolve(`users/${user.uid}/permissions.gsc`);
    });
}

export function getPermissionsForOrigin(origin) {
    var globalConfigData;

    return getGlobalConfig().then(function(data) {
        globalConfigData = data;

        return getUserConfig();
    }).then(function(userConfigData) {
        return {
            ...DEFAULT_PERMISSIONS,
            ...((globalConfigData.origins || {})[origin] || {}),
            ...((userConfigData.origins || {})[origin] || {})
        };
    });
}

export function getPermissionForOriginInContext(origin, permission, context = {}) {
    return getPermissionsForOrigin(origin).then(function(permissions) {
        if (permissions[permission] == "deny") {
            return Promise.resolve("deny");
        }

        if (permissions[permission] == "allowInsecure") {
            return Promise.resolve("allow");
        }

        if (!context.isSecure && PERMISSION_CONTEXTS[permission]?.secureContextOnly) {
            return Promise.resolve("deny");
        }

        if (permissions[permission] == "allow") {
            return Promise.resolve("allow");
        }

        if (!context.isInApp && PERMISSION_CONTEXTS[permission]?.askInAppOnly) {
            return Promise.resolve("deny");
        }

        return Promise.resolve("ask");
    });
}

export function setPermissionForOrigin(origin, permission, value, global = false) {
    return getConfigPath(global).then(function(path) {
        return config.edit(path, function(data) {
            data.origins ||= {};
            data.origins[origin] ||= {};
            data.origins[origin][permission] = value;

            return Promise.resolve(data);
        });
    });
}

export function setSelectUsbDeviceFilters(webview, filters) {
    if (!Array.isArray(filters)) {
        console.warn("USB device selection filters were not sent as an `Array`; ignored");

        return;
    }

    selectUsbDeviceWebview = webview;
    selectUsbDeviceFilters = filters;
}

function createOverlayForWebview(webview) {
    var overlay = $g.create("div")
        .addClass("switcher_overlay")
        .addClass("panel")
        .addClass("getBlurEvents")
        .addClass("permissions_selectDevice")
        .setAttribute("hidden", true)
    ;

    var webviewRect = webview.get().getBoundingClientRect();

    overlay.applyStyle({
        "top": `calc(${webviewRect.top}px + 0.25rem)`,
        "left": `calc(${webviewRect.left}px + 0.25rem)`
    });

    requestAnimationFrame(function() {
        displays.fitElementInsideDisplay(overlay);
    });

    $g.sel(".switcher_overlays").add(overlay);

    return overlay;
}

export function init() {
    gShell.on("permissions_request", function(event, data) {
        var webview = webviewManager.webviewsByWebContentsId[data.webContentsId];

        if (!webview) {
            console.error("No webview found to respond to permission request");

            return;
        }

        var urlInfo = new URL(webview.get().getURL());

        function respond(granted) {
            gShell.call("permissions_respondToRequest", {
                requestId: data.requestId,
                permission: data.permission,
                origin: urlInfo.origin,
                granted
            });
        }

        getPermissionForOriginInContext(urlInfo.origin, data.permission, {
            secureContextOnly: urlInfo.protocol != "http:"
        }).then(function(grantStatus) {
            switch (grantStatus) {
                case "allow":
                    respond(true);
                    break;

                case "ask":
                    // TODO: Ask user whether to grant permission or not
                    console.log("Permission request needs responding to:", respond);
                    break;

                default:
                    respond(false);
                    break;
            }
        });
    });

    gShell.on("permissions_usbSelectionRequest", function(event, data) {
        var webview = webviewManager.webviewsByWebContentsId[data.webContentsId];

        if (!webview) {
            console.error("No webview found to respond to permission request");

            return;
        }

        if (pendingUsbSelectionRequests[data.webContentsId]) {
            gShell.call("permissions_respondToUsbSelectionRequest", {
                requestId: data.requestId,
                selectedDeviceId: null
            });

            return;
        }

        var filters = null;

        if (webview != selectUsbDeviceWebview) {
            return;
        }

        filters = [...selectUsbDeviceFilters];

        selectUsbDeviceWebview = null;
        selectUsbDeviceFilters = null;

        var urlInfo = new URL(webview.get().getURL());

        var overlay = createOverlayForWebview(webview);
        var deviceList = $g.create("div").addClass("permissions_deviceList");

        var confirmButton = $g.create("button")
            .addAttribute("disabled")
            .setText(_("ok"))
        ;

        var cancelButton = $g.create("button")
            .setAttribute("aui-mode", "secondary")
            .setText(_("cancel"))
        ;

        var radioInputGroup = `permissions_deviceList_${$g.core.generateKey()}`;
        var selectedDeviceId = null;

        function checkSelectedDevice() {
            if (deviceList.find("input:checked").items().length == 0) {
                selectedDeviceId = null;

                confirmButton.addAttribute("disabled");

                return;
            }

            selectedDeviceId = deviceList.find("input:checked").getAttribute("value");

            confirmButton.removeAttribute("disabled");
        }

        function closeOverlay() {
            delete pendingUsbSelectionRequests[data.webContentsId];

            overlay.removeClass("getBlurEvents");

            switcher.hideOverlay(overlay).then(function() {
                overlay.remove();
            });
        }

        function cancelRequest() {
            gShell.call("permissions_respondToUsbSelectionRequest", {
                requestId: data.requestId,
                selectedDeviceId: null
            });

            closeOverlay();
        }

        function updateDeviceList() {
            var filteredDevices = data.devices.filter(function(device) {
                if (filters == null) {
                    return true;
                }

                var matched = false;

                filters.forEach(function(filter) {
                    if (typeof(filter) != "object") {
                        console.warn("A USB device selection filter was not sent as an `Object`; ignored");

                        return;
                    }

                    var shouldReject = false;

                    function checkMatch(filterProperty, deviceProperty = filterProperty) {
                        if (shouldReject || !filter.hasOwnProperty(filterProperty)) {
                            return;
                        }

                        if (filter[filterProperty] != device[deviceProperty]) {
                            shouldReject = true;
                        }
                    }

                    // List obtained from https://developer.mozilla.org/en-US/docs/Web/API/USB/requestDevice#parameters
                    checkMatch("vendorId");
                    checkMatch("productId");
                    checkMatch("classCode", "deviceClass");
                    checkMatch("subclassCode", "deviceSubclass");
                    checkMatch("protocolCode", "deviceProtocol");
                    checkMatch("serialNumber");

                    matched ||= !shouldReject;
                });

                return matched;
            });

            if (filteredDevices.length > 0) {
                deviceList.clear().add(
                    ...filteredDevices.map(function(device) {
                        var id = `permissions_device_${$g.core.generateKey()}`;
    
                        return $g.create("div").add(
                            $g.create("input")
                                .setId(id)
                                .setAttribute("type", "radio")
                                .setAttribute("name", radioInputGroup)
                                .setAttribute("value", device.deviceId)
                                .condition(device.deviceId == selectedDeviceId, (element) => element.addAttribute("checked"))
                                .on("change", function() {
                                    checkSelectedDevice();
                                })
                            ,
                            $g.create("label")
                                .setAttribute("for", id)
                                .setText(device.productName.trim() || _("unknown"))
                        );
                    })
                );
            } else {
                deviceList.clear().add(
                    $g.create("p")
                        .addClass("permissions_noDevicesFoundMessage")
                        .setText(_("permissions_noDevicesFound"))
                );
            }

            checkSelectedDevice();
        }

        pendingUsbSelectionRequests[data.webContentsId] = {
            addUsbDevice: function(device) {
                if (data.devices.find((existingDevice) => existingDevice.deviceId == device.deviceId)) {
                    return;
                }

                data.devices.push(device);

                updateDeviceList();
            },
            removeUsbDevice: function(device) {
                data.devices = data.devices.filter((existingDevice) => existingDevice.deviceId == device.deviceId);

                updateDeviceList();
            }
        };

        confirmButton.on("click", function() {
            gShell.call("permissions_respondToUsbSelectionRequest", {
                requestId: data.requestId,
                selectedDeviceId
            });

            closeOverlay();
        });

        cancelButton.on("click", function() {
            cancelRequest();
        });

        overlay.on("bluroverlay", function() {
            cancelRequest();
        });

        overlay.add(
            $g.create("h1").add(
                $g.create("span").setText(_("permissions_selectUsbDevice_prefix")),
                $g.create("strong").setText(webview.appDetails?.displayName?.trim() || urlInfo.host),
                $g.create("span").setText(_("permissions_selectUsbDevice_suffix"))
            ),
            deviceList,
            $g.create("aui-buttons")
                .setAttribute("aui-mode", "end")
                .add(
                    confirmButton,
                    cancelButton
                )
        );

        updateDeviceList();

        switcher.showOverlay(overlay);
    });

    gShell.on("permissions_addUsbDevice", function(event, data) {
        pendingUsbSelectionRequests[data.webContentsId]?.addUsbDevice(data.device);
    });

    gShell.on("permissions_removeUsbDevice", function(event, data) {
        pendingUsbSelectionRequests[data.webContentsId]?.removeUsbDevice(data.device);
    });
}