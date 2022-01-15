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

    gShell.call("system_getFlags").then(function(flags) {
        if (flags.isRealHardware) {
            document.querySelector("#flagInfo").textContent = "Running on real hardware!";
        } else {
            document.querySelector("#flagInfo").textContent = "Running in simulator!";
        }
    });

    function checkStatus() {
        gShell.call("power_getState").then(function(response) {
            if (response.state == null) {
                document.querySelector("#batteryStatus").textContent = "No battery detected";
    
                return;
            }
    
            document.querySelector("#batteryStatus") = `Battery: ${response.state}, ${response.level}%`;
        });
    }

    setInterval(checkStatus, 5_000);
    checkStatus();
});