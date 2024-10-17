/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

export var UserButton = astronaut.component("UserButton", function(props, children) {
    // This is for backwards compatibility from V0.2.0 where `users.gsc` will still reference `isAdmin`
    var isAdmin = props.isAdmin || props.permissionLevel == "admin";

    return IconListButton (
        Icon("user", "dark embedded") (),
        Container (
            BoldTextFragment() (props.displayName),
            LineBreak() (),
            Text(isAdmin ? _("users_admin") : _("users_standard"))
        )
    );
});

export var UsersPage = astronaut.component("UsersPage", function(props, children) {
    var currentUserContainer = Container() ();
    var otherUsersContainer = Container() ();
    var anyOtherUsers = false;

    function updateData() {
        var data = _sphere.getPrivilegedData();
        var users = data?.users_data?.users || {};

        currentUserContainer.clear();
        otherUsersContainer.clear();

        Object.keys(users).forEach(function(uid) {
            var user = users[uid];
            var isCurrentUser = uid == data.users_currentUserId;

            if (!isCurrentUser) {
                anyOtherUsers = true;
            }

            (isCurrentUser ? currentUserContainer : otherUsersContainer).add(UserButton(user) ());
        });
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return Page (
        Section (
            currentUserContainer,
            Heading({
                level: 5,
                styles: {
                    "display": anyOtherUsers ? "block" : "none",
                    "margin-block": "0.5rem"
                }
            }) (_("users_otherUsers")),
            otherUsersContainer
        )
    );
});