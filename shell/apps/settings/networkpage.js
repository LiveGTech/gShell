/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";
import * as screens from "gshell://lib/adaptui/src/screens.js";

import * as settings from "./script.js";
import * as shortcuts from "./shortcuts.js";
import * as wifiAuthModes from "./wifiauthmodes.js";

export var NetworkPage = astronaut.component("NetworkPage", function(props, children) {
    var wifiScanResultsContainer = Container({
        styles: {
            marginLeft: "-0.5rem",
            marginRight: "-0.5rem"
        }
    }) ();

    var proxyConfigButton = IconListButton (
        Icon("router", "dark embedded") (),
        Container (
            BoldTextFragment() (_("network_proxyConfig")),
            LineBreak() (),
            _("network_proxyConfig_summary")
        )
    );

    proxyConfigButton.on("click", function() {
        settings.visitInnerScreen(
            ProxyConfigScreen() ()
        );
    });

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
            shortcuts.ShortcutLandmark("network_wifi") (),
            Heading(2) (_("network_wifiNetworks")),
            wifiScanResultsContainer
        ),
        Section (
            proxyConfigButton
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

    var exitScreen = screen.inter.exit;

    function forgetAp() {
        return _sphere.callPrivilegedCommand("network_forgetWifi", {
            name: props.accessPoint.name
        }).then(function() {
            updateData();

            return _sphere.callPrivilegedCommand("network_scanWifi");
        });
    }

    function showInvalidAuthDialog(fromSavedNetwork) {
        var dialog = Dialog (
            Heading() (_("network_invalidAuth_title")),
            DialogContent (
                Paragraph() (fromSavedNetwork ? _("network_invalidAuth_description_fromSaved") : _("network_invalidAuth_description"))
            ),
            ButtonRow("end") (
                Button({
                    attributes: {
                        "aui-bind": "close"
                    }
                }) (_("ok"))
            )
        );

        settings.registerDialog(dialog);

        dialog.dialogOpen();
        forgetAp();
    }

    function showConnectionErrorDialog() {
        var dialog = Dialog (
            Heading() (_("network_connectionError_title")),
            DialogContent (
                Paragraph() (_("network_connectionError_description"))
            ),
            ButtonRow("end") (
                Button({
                    attributes: {
                        "aui-bind": "close"
                    }
                }) (_("ok"))
            )
        );

        settings.registerDialog(dialog);

        dialog.dialogOpen();
    }

    function updateData() {
        if (!active) {
            return;
        }

        var data = _sphere.getPrivilegedData();
        var listResults = data?.network_listResults || [];
        var apResults = (data?.network_wifiScanResults || []).filter((result) => result.name == props.accessPoint.name);
        var connected = apResults.filter((result) => result.connected).length > 0;
        var connectionIsSaved = !!listResults.find((result) => result.name == props.accessPoint.name);
        var connectionIsOpen = props.accessPoint.security.length == 0;

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

        var forgetButton = Button("dangerous") (_("network_wifiAp_forget"));

        forgetButton.on("click", function() {
            forgetAp();
        });

        if (connected) {
            var disconnectButton = Button() (_("network_wifiAp_disconnect"));

            disconnectButton.on("click", function() {
                _sphere.callPrivilegedCommand("network_disconnectWifi", {
                    name: props.accessPoint.name
                }).then(function() {
                    _sphere.callPrivilegedCommand("network_scanWifi");
                });

                exitScreen();
            });

            forgetButton.on("click", function() {
                exitScreen();
            });

            mainActions.clear().add(
                disconnectButton,
                forgetButton
            );
        } else {
            var connectButton = Button() (_("network_wifiAp_connect"));

            if (data?.network_connectingToWifi == props.accessPoint.name) {
                connectButton.addAttribute("disabled");
                connectButton.setText(_("network_wifiAp_connecting"));
            }

            connectButton.on("click", function() {
                if (connectionIsSaved || connectionIsOpen) {
                    Promise.resolve().then(function() {
                        if (connectionIsSaved) {
                            return Promise.resolve();
                        }

                        return _sphere.callPrivilegedCommand("network_configureWifi", {
                            name: props.accessPoint.name
                        });
                    }).then(function() {
                        return _sphere.callPrivilegedCommand("network_connectWifi", {
                            name: props.accessPoint.name
                        });
                    }).then(function(status) {
                        if (status == "invalidAuth") {
                            showInvalidAuthDialog(true);

                            connectionIsSaved = false;
                        }

                        return Promise.resolve();
                    }).catch(function(error) {
                        console.warn(error);
            
                        showConnectionErrorDialog();
                    });
                } else {
                    var dialog = WifiConnectionConfigDialog({accessPoint: props.accessPoint, parentScreen: screen}) ();

                    dialog.on("connectionsaved", function() {
                        connectionIsSaved = true;
                    });

                    dialog.on("invalidauth", function() {
                        showInvalidAuthDialog();

                        connectionIsSaved = false;
                    });

                    settings.registerDialog(dialog);

                    dialog.dialogOpen();

                    dialog.find(".app_settings_makeFirstFocus").focus();
                }
            });

            forgetButton.on("click", function() {
                connectionIsSaved = false;

                forgetButton.remove();
            });

            mainActions.clear().add(
                connectButton,
                forgetButton
            );

            if (!connectionIsSaved || data?.network_connectingToWifi) {
                forgetButton.remove();
            }
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

    screen.on("removed", function() {
        active = false;
    });

    return screen;
});

export var ProxyConfigScreen = astronaut.component("ProxyConfigScreen", function(props, children) {
    var modeRadioButtons = {
        direct: RadioButtonInput({group: "network_proxyMode"}) (),
        autoDetect: RadioButtonInput({group: "network_proxyMode"}) (),
        pacScriptUrl: RadioButtonInput({group: "network_proxyMode"}) (),
        socks: RadioButtonInput({group: "network_proxyMode"}) (),
        http: RadioButtonInput({group: "network_proxyMode"}) ()
    };

    var modeDependencies = {
        pacScriptUrl: Dependency (
            Label (
                Text((_("network_proxyConfig_pacScriptUrl_url"))),
                Input({type: "url", attributes: {"spellcheck": "false"}}) ()
            )
        ),
        socks: Dependency (
            Label (
                Text(_("network_proxyConfig_socks_url")),
                Input({type: "url", attributes: {"spellcheck": "false"}}) ()
            )
        ),
        http: Dependency (
            Label (
                Text(_("network_proxyConfig_http_httpUrl")),
                Input({type: "url", attributes: {"spellcheck": "false"}}) ()
            ),
            Label (
                Text(_("network_proxyConfig_http_httpsUrl")),
                Input({type: "url", placeholder: _("optional"), attributes: {"spellcheck": "false"}}) ()
            )
        )
    };

    var saveButton = Button() (_("save"));
    var cancelButton = Button({mode: "secondary"}) (_("cancel"));

    var screen = settings.InnerScreen({title: _("network_proxyConfig")}) (
        Page(true) (
            Section (
                Heading() (_("network_proxyConfig")),
                Paragraph() (_("network_proxyConfig_description")),
                Label (
                    modeRadioButtons.direct,
                    BoldTextFragment() (_("network_proxyConfig_direct"))
                ),
                Label (
                    modeRadioButtons.autoDetect,
                    BoldTextFragment() (_("network_proxyConfig_autoDetect"))
                ),
                Label (
                    modeRadioButtons.pacScriptUrl,
                    BoldTextFragment() (_("network_proxyConfig_pacScriptUrl"))
                ),
                modeDependencies.pacScriptUrl,
                Label (
                    modeRadioButtons.socks,
                    BoldTextFragment() (_("network_proxyConfig_socks"))
                ),
                modeDependencies.socks,
                Label (
                    modeRadioButtons.http,
                    BoldTextFragment() (_("network_proxyConfig_http"))
                ),
                modeDependencies.http
            ),
            Section (
                Paragraph() (_("network_proxyConfig_saveNotice")),
                ButtonRow (
                    saveButton,
                    cancelButton
                )
            )
        )
    );

    function updateDependencies() {
        Object.keys(modeDependencies).forEach(function(mode) {
            if (modeRadioButtons[mode].getValue()) {
                modeDependencies[mode].removeAttribute("inert");
            } else {
                modeDependencies[mode].setAttribute("inert", "dependent");
            }
        });
    }

    Object.values(modeRadioButtons).forEach(function(radioButton) {
        radioButton.on("change", function() {
            updateDependencies();
        });
    });

    var exit = screen.inter.exit;

    saveButton.on("click", function() {
        saveButton.addAttribute("disabled");
        saveButton.setText(_("saving"));

        // TODO: Replace dummy delay with actual saving of proxy settings

        setTimeout(function() {
            exit();
        }, 500);
    });

    cancelButton.on("click", function() {
        exit();
    });

    _sphere.callPrivilegedCommand("network_getProxy").then(function(data) {
        modeRadioButtons[data.mode || "direct"].setValue(true);

        updateDependencies();
    });

    return screen;
});

export var WifiConnectionConfigDialog = astronaut.component("WifiConnectionConfigDialog", function(props, children) {
    var preferredAuthMode = props.accessPoint.security.filter((mode) => mode != "802_1x")[0] || "none";

    if (props.accessPoint.security.includes("wpa1") || props.accessPoint.security.includes("wpa2")) {
        preferredAuthMode = "wpa";
    }

    if (props.accessPoint.security.includes("802_1x")) {
        preferredAuthMode += "_802_1x";
    }

    var authModeInput = SelectionInput({value: preferredAuthMode}) (
        SelectionInputOption("none") (_("network_wifiConfig_authMode_none")),
        SelectionInputOption("wep") (_("network_wifiConfig_authMode_wep")),
        SelectionInputOption("wpa") (_("network_wifiConfig_authMode_wpa")),
        SelectionInputOption("wpa_802_1x") (_("network_wifiConfig_authMode_wpa_802_1x"))
    );

    var connectButton = Button() (_("network_wifiConfig_connect"));

    var authModeConfigContainer = Container() ();
    var currentAuthModeConfigElement = null;

    var dialog = Dialog (
        Heading() (_("network_wifiConfig_title", {name: props.accessPoint.name})),
        DialogContent (
            Label (
                Text(_("network_wifiConfig_authMode")),
                authModeInput
            ),
            authModeConfigContainer
        ),
        ButtonRow("end") (
            connectButton,
            Button({
                mode: "secondary",
                attributes: {
                    "aui-bind": "close"
                }
            }) (_("cancel"))
        )
    );

    function renderAuthModeConfigContainer() {
        currentAuthModeConfigElement = wifiAuthModes.components[authModeInput.getValue()]() ();

        currentAuthModeConfigElement.find("input").on("input", function() {
            validate();
        });

        currentAuthModeConfigElement.find("input[type='password']").on("keydown", function(event) {
            if (event.key == "Enter") {
                connect();
            }
        });

        validate();

        authModeConfigContainer.clear().add(currentAuthModeConfigElement);
    }

    function validate() {
        if (currentAuthModeConfigElement.inter.isValid()) {
            connectButton.removeAttribute("disabled");
        } else {
            connectButton.addAttribute("disabled");
        }
    }

    function connect() {
        if (!currentAuthModeConfigElement.inter.isValid()) {
            return Promise.reject("Invalid auth config settings");
        }

        dialog.dialogClose();

        return _sphere.callPrivilegedCommand("network_configureWifi", {
            name: props.accessPoint.name,
            auth: currentAuthModeConfigElement.inter.getAuthConfig()
        }).then(function() {
            dialog.emit("connectionsaved");

            return _sphere.callPrivilegedCommand("network_connectWifi", {
                name: props.accessPoint.name
            });
        }).then(function(status) {
            if (status == "invalidAuth") {
                dialog.emit("invalidauth");
            }

            return Promise.resolve();
        }).catch(function(error) {
            console.warn(error);

            showConnectionErrorDialog();
        });
    }

    authModeInput.on("change", function() {
        renderAuthModeConfigContainer();
    });

    connectButton.on("click", function() {
        connect();
    });

    renderAuthModeConfigContainer();

    return dialog;
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
        } else {
            summary.setText(_("network_summaryDisconnected"));
        }
    }

    _sphere.onPrivilegedDataUpdate(updateSummary);
    updateSummary();
}