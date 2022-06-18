/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

export var NetworkPage = astronaut.component("NetworkPage", function(props, children) {
    var wifiScanResultsContainer = Container() ();

    function updateData() {
        var data = _sphere.getPrivilegedData();

        wifiScanResultsContainer.clear().add(
            ...(data?.network_wifiScanResults || [])
                .filter((result) => result.name != "")
                .map(function(result) {
                    var securityType = "unknown";

                    if (result.security.length == 0) {
                        securityType = "open";
                    } else if (result.security.includes("wpa2")) {
                        securityType = "wpa2";
                    } else if (result.security.includes("wpa1")) {
                        securityType = "wpa1";
                    } else if (result.security.includes("wep")) {
                        securityType = "wep";
                    }

                    var details = [];

                    if ((data?.network_listResults || []).filter((result) => result.connected)[0]?.name == result.name) {
                        details.push(_("network_connected"));
                    }

                    if (securityType == "open") {
                        details.push(_("network_wifiSecurityType_open"));
                    } else if (securityType == "unknown") {
                        details.push(_("network_wifiSecurityType_unknown"));
                    } else {
                        details.push(_("network_wifiSecurityType_secured"));
                    }

                    return ListButton() (
                        BoldTextFragment() (result.name),
                        LineBreak() (),
                        Text(_("network_wifiScanResultDetails", {
                            details: details.join(" · "),
                            bandwidth: result.bandwidth
                        }))
                    )
                })
        );
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page() (
        Section (
            Heading(2) (_("network_wifiNetworks")),
            wifiScanResultsContainer
        )
    );
});

export function connectSummary(summary) {
    function updateSummary() {
        var data = _sphere.getPrivilegedData();
        var listResults = data?.network_listResults || [];
        var genericConnection = listResults.filter((result) => result.connected);
        var wifiConnection = genericConnection.filter((result) => result.type == "wifi");
        var ethernetConnection = genericConnection.filter((result) => result.type == "ethernet");

        if (wifiConnection && typeof(wifiConnection[0]?.name) == "string") {
            summary.setText(_("network_summaryConnectedWifi", {name: wifiConnection[0]?.name}));
        } else if (ethernetConnection) {
            summary.setText(_("network_summaryConnectedEthernet"));
        } else if (genericConnection) {
            summary.setText(_("network_summaryConnected"));
        } else {
            summary.setText(_("network_summaryDisconnected"));
        }
    }

    _sphere.onPrivilegedDataUpdate(updateSummary);
    updateSummary();
}