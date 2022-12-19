/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

export function noInputModeFactory(config, internalConfig) {
    return astronaut.component({isPrivate: true}, function(props, children, inter) {
        inter.getAuthConfig = function() {
            return config;
        };

        inter.isValid = function() {
            return true;
        };
    
        return Container() ();
    });
}

export function passwordInputModeFactory(config, internalConfig) {
    return astronaut.component({isPrivate: true}, function(props, children, inter) {
        var passwordInput = Input("password") ();

        inter.getAuthConfig = function() {
            return {
                ...config,
                "wifi-sec.psk": passwordInput.getValue()
            };
        };

        inter.isValid = function() {
            var length = passwordInput.getValue().length;

            return (!internalConfig.minLength || length >= internalConfig.minLength) && (!internalConfig.maxLength || length <= internalConfig.maxLength);
        };

        passwordInput.addClass("app_settings_makeFirstFocus");
    
        return Container (
            Label (
                Text(_("network_wifiConfig_authModes_password")),
                passwordInput
            )
        );
    });
}

export function identityInputModeFactory(config, internalConfig) {
    return astronaut.component({isPrivate: true}, function(props, children, inter) {
        // TODO: Support more than just PEAP as EAP method

        var innerAuthMode = SelectionInput({value: "mschapv2"}) (
            SelectionInputOption("mschapv2") (_("network_wifiConfig_authModes_innerAuthMode_mschapv2")),
            SelectionInputOption("gtc") (_("network_wifiConfig_authModes_innerAuthMode_gtc"))
        );

        var usernameInput = Input() ();
        var anonymousIdentityInput = Input({placeholder: _("optional")}) ();
        var passwordInput = Input("password") ();

        inter.getAuthConfig = function() {
            return {
                ...config,
                "wifi-sec.key-mgmt": "eap",
                "802-1x.eap": "peap",
                "802-1x.password": passwordInput.getValue()
            };
        };

        inter.isValid = function() {
            // Password input may be blank as some users may not have passwords on their network (as insecure as that would be)
            return usernameInput.getValue() != "";
        };

        usernameInput.addClass("app_settings_makeFirstFocus");

        return Container (
            Label (
                Text(_("network_wifiConfig_authModes_innerAuthMode")),
                innerAuthMode
            ),
            Label (
                Text(_("network_wifiConfig_authModes_innerAuthMode_username")),
                usernameInput
            ),
            Label (
                Text(_("network_wifiConfig_authModes_innerAuthMode_anonymousIdentity")),
                anonymousIdentityInput
            ),
            Label (
                Text(_("network_wifiConfig_authModes_password")),
                passwordInput
            )
        );
    });
}

export var components = {
    none: noInputModeFactory({}),
    wep: noInputModeFactory({
        "wifi-sec.key-mgmt": "none"
    }),
    wpa: passwordInputModeFactory({
        "wifi-sec.key-mgmt": "wpa-psk"
    }, {
        minLength: 8,
        maxLength: 63
    }),
    wpa_802_1x: identityInputModeFactory()
};