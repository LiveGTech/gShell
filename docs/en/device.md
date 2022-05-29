# Device description file
A device description file (DDF) tells gShell what kind of device it is running on, and contains details on how gShell can communicate with applicable hardware through its system abstraction layer (`src/system.js`). It's conceptually similar to a device tree overlay file in Linux.

The default path for the DDF is `storage://device.gsc`, though this can be overridden through using the `--device-desc-location` flag (with the path excluding the `storage://` prefix).

The DDF is not required to run gShell; gShell will instead use generic values, which may disable some features (such as battery reporting) due to the lack of the required description properties that are needed to communicate with battery hardware. If a DDF is used, properties that are not relevant to the device can be excluded — if a device does not rely on the use of a battery, then the `hardware.batteryStateReporter`, `hardware.batteryStateMapping` and `hardware.batteryLevelReporter` properties can be omitted.

## Example DDF
Here is an example of the contents of a DDF, following the JSON format:

```json
{
    "type": "mobile",
    "model": {
        "codename": "smartex",
        "serial": "STX12345678",
        "fallbackLocale": "en_GB",
        "name": {"en_GB": "Smartex Pro"},
        "manufacturer": {"en_GB": "Affine Industries"}
    },
    "hardware": {
        "batteryStateReporter": "/sys/class/power_supply/BAT0/status",
        "batteryStateMapping": {
            "Charging": "charging",
            "Discharging": "discharging",
            "Not charging": "notCharging",
            "Full": "full"
        },
        "batteryLevelReporter": "/sys/class/power_supply/BAT0/capacity"
    }
}
```

> **Note:** Not all devices will have this exact configuration with regards to the hardware details. Ensure that the hardware details of the target device are correctly entered into the DDF.

## What each property does
Many properties can be complex in nature, and so their explanations have been listed below.

### `type`
The form factor of the target device, such as whether the device is a smartphone or a desktop computer.

Valid values include:

* `"mobile"`: A mobile smartphone

### `model.codename`
The codename of the target device. For example, for the LiveG Prism, its codename is `"prism"`. The codename is generally used for programmatic comparisons inside apps and other software, and so should not be set to be a locale object.

### `model.serial`
The serial number of the target device, which is typically unique for every instance for the device. This serial number may also match that printed on the actual hardware itself. It is a string and can contain any symbol — not just numeric digits.

We recommend choosing any of the characters `A`-`Z`, `0`-`9`, `.` and `-`, and having the serial string all uppercase.

### `model.fallbackLocale`
The fallback locale code to use for the device model's user-facing details (such as the name of the model and its manufacturer) in the case where the user chooses a different locale in gShell to one that is listed for the model name/manufaturer details.

### `model.name`
The name of the device's model, stored as an object of locale codes to localised names.

### `model.manufacturer`
The manufacturer's name of the device's model, stored as an object of locale codes to localised names.

### `hardware.batteryStateReporter`
The path of the OS file to look up (outside of the gShell fileystem) to retrieve the current battery state (charging, discharging etc.).

### `hardware.batteryStateMapping`
An object that maps the `hardware.batteryStateReporter` file's contents to the state name that gShell uses.

Valid state values include:

* `charging`: Device is connected to a power supply and is charging the battery
* `discharging`: Device is disconnected from a power supply and is discharging the battery
* `notCharging`: Device is connected to a power supply but is unable to charge the battery in addition to actively powering the device due to insufficient power delivery (such as when a low-current power supply is used)
* `full`: Device's battery is full

### `hardware.batteryLevelReporter`
The path of the OS file to look up (outside of the gShell fileystem) to retrieve the current battery level percentage (with the file's contents being parsable as an integer, such as `80`).