/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

import * as settings from "./script.js";

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

                    var button = IconListButton() (
                        Icon(`wifi-${Math.round((result.signal / 100) * 2)}`, "dark embedded") (),
                        Container (
                            BoldTextFragment() (result.name),
                            LineBreak() (),
                            Text(_("network_wifiScanResultDetails", {
                                details: details.join(" ?? "),
                                bandwidth: result.bandwidth
                            }))
                        )
                    );

                    button.on("click", function() {
                        settings.visitInnerScreen(
                            WifiApScreen({accessPoint: result}) ()
                        );
                    });

                    return button;
                })
        );
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page (
        Section (
            Heading(2) (_("network_wifiNetworks")),
            wifiScanResultsContainer
        )
    );
});

export var WifiApScreen = astronaut.component("WifiApScreen", function(props, children) {
    var active = true;

    var iconContainer = Container() ();

    var mainActions = ButtonRow({
        styles: {
            justifyContent: "center"
        }
    }) ();

    var channelDetails = Container() ();

    var screen = settings.InnerScreen({title: props.accessPoint.name}) (
        Page(true) (
            Section({
                attributes: {
                    "aui-justify": "middle"
                }
            }) (
                iconContainer,
                Heading({
                    level: 1,
                    styles: {
                        marginTop: "0",
                        marginBottom: "0.5rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }
                }) (props.accessPoint.name),
                mainActions
            ),
            Section (
                Accordion (
                    Text(_("network_wifiAp_channelDetails")),
                    channelDetails
                )
            )
        )
    );

    screen.on("removed", function() {
        active = false;
    });

    function updateData() {
        if (!active) {
            return;
        }

        var data = _sphere.getPrivilegedData();
        var apResults = (data?.network_wifiScanResults || []).filter((result) => result.name == props.accessPoint.name);

        var connected = (data?.network_listResults || [])
            .filter((result) => result.name == props.accessPoint.name)
            .filter((result) => result.type == "wifi")
            .filter((result) => result.connected)
            .length != 0
        ;

        if (apResults.length == 0) {
            // TODO: Add not in range message

            return;
        }

        iconContainer.clear().add(
            Icon({
                icon: `wifi-${Math.round((apResults.sort((a, b) => b.signal - a.signal)[0].signal / 100) * 2)}`,
                type: "dark embedded",
                styles: {
                    height: "4rem"
                }
            }) ()
        );

        // TODO: Add functionality to these buttons
        if (connected) {
            mainActions.clear().add(
                Button() (_("network_wifiAp_disconnect")),
                Button("dangerous") (_("network_wifiAp_forget"))
            );
        } else {
            mainActions.clear().add(
                Button() (_("network_wifiAp_connect"))
            );
        }

        channelDetails.clear().add(
            ...apResults.sort((a, b) => a.channel - b.channel).map((accessPoint) => Container() (
                Heading(3) (_("network_wifiAp_channel", {channel: accessPoint.channel})),
                PropertyList (
                    Property() (_("network_wifiAp_bssid"), CodeSnippet() (accessPoint.bssid)),
                    Property() (_("network_wifiAp_signalStrength"), _("network_wifiAp_signalStrength_value", {value: accessPoint.signal})),
                    Property() (_("network_wifiAp_bandwidth"), _("network_wifiAp_bandwidth_value", {value: accessPoint.bandwidth}))
                )
            ))
        );
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return screen;
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