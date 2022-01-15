/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

window.addEventListener("load", function() {
    document.getElementById("#shutDownButton").addEventListener("click", function() {
        gShell.call("power_shutDown");
    });
});