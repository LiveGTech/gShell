/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export const SIZE_RADICES = {
    metric: 1_000,
    iec: 1_024
};

function roundToDecimalPlaces(value, decimalPlaces) {
    return Math.round(value * (10 ** decimalPlaces)) / (10 ** decimalPlaces);
}

export function getString(size, units = "metric", decimalPlaces = 1) {
    var radix = SIZE_RADICES[units];

    if (size < radix ** 1) {
        return _("size_bytes", {size});
    }

    if (size < radix ** 2) {
        return _(
            {metric: "size_kb", iec: "size_kib"}[units],
            {size: roundToDecimalPlaces(size / (radix ** 1), decimalPlaces)}
        );
    }

    if (size < radix ** 3) {
        return _(
            {metric: "size_mb", iec: "size_mib"}[units],
            {size: roundToDecimalPlaces(size / (radix ** 2), decimalPlaces)}
        );
    }

    if (size < radix ** 4) {
        return _(
            {metric: "size_gb", iec: "size_gib"}[units],
            {size: roundToDecimalPlaces(size / (radix ** 3), decimalPlaces)}
        );
    }

    return _(
        {metric: "size_tb", iec: "size_tib"}[units],
        {size: roundToDecimalPlaces(size / (radix ** 4), decimalPlaces)}
    );
}