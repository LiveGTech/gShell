/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export var x = 0;
export var y = 0;

export function init() {
    requestAnimationFrame(function update() {
        gShell.call("io_getPointerPosition").then(function(data) {
            x = data.x;
            y = data.y;

            requestAnimationFrame(update);
        });
    });
}