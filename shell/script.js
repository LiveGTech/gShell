/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

window.addEventListener("load", function() {
    document.querySelector("#shutDownButton").addEventListener("click", function() {
        console.log("Nice");
        gShell.call("power_shutDown");
    });
});