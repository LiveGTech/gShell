/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

// TODO: Translate text in components
// TODO: Add validation inter function in components

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
                Text("Password"),
                passwordInput
            )
        );
    });
}

export function identityInputModeFactory(config, internalConfig) {
    return astronaut.component({isPrivate: true}, function(props, children, inter) {
        // TODO: Support more than just PEAP as EAP method

        var innerAuthMode = SelectionInput({value: "mschapv2"}) (
            SelectionInputOption("mschapv2") ("MS-CHAP V2"),
            SelectionInputOption("gtc") ("GTC")
        );

        var usernameInput = Input() ();
        var anonymousIdentityInput = Input({placeholder: "(Optional)"}) ();
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
                Text("Inner authentication mode"),
                innerAuthMode
            ),
            Label (
                Text("Username (identity)"),
                usernameInput
            ),
            Label (
                Text("Anonymous identity"),
                anonymousIdentityInput
            ),
            Label (
                Text("Password"),
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