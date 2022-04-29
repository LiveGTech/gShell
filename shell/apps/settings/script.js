/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

astronaut.unpack();

astronaut.render(
    Screen(true) (
        Header (
            Text("Settings")
        ),
        Page(true) (
            Section (
                Heading() ("In development")
            )
        )
    )
);