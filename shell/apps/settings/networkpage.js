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
        var usedNames = [];

        if (data?.network_wifiScanResults?.length > 0) {
            wifiScanResultsContainer.clear().add(
                ...(data?.network_wifiScanResults || [])
                    .sort((a, b) => a.connected ? -1 : 1)
                    .filter(function(result) {
                        if (result.name == "") {
                            return false;
                        }

                        if (usedNames.includes(result.name)) {
                            return false;
                        }

                        usedNames.push(result.name);

                        return true;
                    })
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

                        if (result.connected) {
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
                                    details: details.join(" · "),
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
        } else {
            wifiScanResultsContainer.clear().add(
                Message (
                    Heading(3) (_("network_wifiNetworksNone_title")),
                    Paragraph() (_("network_wifiNetworksNone_description"))
                )
            );
        }
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
        var connected = apResults.filter((result) => result.connected).length > 0;

        if (apResults.length == 0) {
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

        if (connected) {
            var disconnectButton = Button() (_("network_wifiAp_disconnect"));
            var forgetButton = Button("dangerous") (_("network_wifiAp_forget"));

            disconnectButton.on("click", function() {
                _sphere.callPrivilegedCommand("network_disconnectWifi", {
                    name: props.accessPoint.name
                }).then(function() {
                    _shpere.callPrivilegedCommand("network_scanWifi");
                });
            });

            forgetButton.on("click", function() {
                _sphere.callPrivilegedCommand("network_forgetWifi", {
                    name: props.accessPoint.name
                }).then(function() {
                    _shpere.callPrivilegedCommand("network_scanWifi");
                });
            });

            mainActions.clear().add(
                disconnectButton,
                forgetButton
            );
        } else {
            var connectButton = Button() (_("network_wifiAp_connect"));

            connectButton.on("click", function() {
                settings.visitInnerScreen(
                    WifiConnectionConfigScreen({accessPoint: props.accessPoint}) ()
                );
            });

            // connectButton.on("click", function() {
            //     _sphere.callPrivilegedCommand("network_configureWifi", {
            //         name: props.accessPoint.name
            //     }).then(function() {
            //         return _sphere.callPrivilegedCommand("network_connectWifi", {
            //             name: props.accessPoint.name
            //         });
            //     }).then(function() {
            //         _shpere.callPrivilegedCommand("network_scanWifi");
            //     });
            // });

            mainActions.clear().add(
                connectButton
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

export var WifiConnectionConfigScreen = astronaut.component("WifiConnectionConfigScreen", function(props, children) {
    // TODO: Translate screen and add in proper functionality

    var preferredAuthenticationMode = props.accessPoint.security.filter((mode) => mode != "802_1x")[0] || "none";

    if (props.accessPoint.security.includes("802_1x")) {
        preferredAuthenticationMode += "_802_1x";
    }

    var screen = settings.InnerScreen({title: `Authenticate ${props.accessPoint.name}`}) (
        Page(true) (
            Section (
                Label (
                    Text("Authentication mode"),
                    SelectionInput({value: preferredAuthenticationMode}) (
                        SelectionInputOption("none") ("None"),
                        SelectionInputOption("wep") ("WEP"),
                        SelectionInputOption("wpa1") ("WPA1"),
                        SelectionInputOption("wpa1_802_1x") ("WPA1 802.1x (enterprise)"),
                        SelectionInputOption("wpa2") ("WPA2"),
                        SelectionInputOption("wpa2_802_1x") ("WPA2 802.1x (enterprise)"),
                    )
                ),
                Label (
                    Text("Password"),
                    Input("password") ()
                )
            ),
            Section (
                ButtonRow("end") (
                    Button() ("Connect"),
                    Button("secondary") ("Cancel")
                )
            )
        )
    );

    return screen;
});

export function connectSummary(summary) {
    function updateSummary() {
        var data = _sphere.getPrivilegedData();
        var listResults = data?.network_listResults || [];
        var genericConnections = listResults.filter((result) => result.connected);
        var wifiConnections = genericConnections.filter((result) => result.type == "wifi");
        var ethernetConnections = genericConnections.filter((result) => result.type == "ethernet");
        var wifiScanConnectedResults = (data?.network_wifiScanResults || []).filter((result) => result.connected);

        if (wifiConnections.length > 0 && wifiScanConnectedResults.length > 0) {
            summary.setText(_("network_summaryConnectedWifi", {name: wifiScanConnectedResults[0].name}));
        } else if (ethernetConnections.length > 0) {
            summary.setText(_("network_summaryConnectedEthernet"));
        } else if (genericConnections.length > 0) {
            summary.setText(_("network_summaryConnected"));
        } else {
            summary.setText(_("network_summaryDisconnected"));
        }
    }

    _sphere.onPrivilegedDataUpdate(updateSummary);
    updateSummary();
}