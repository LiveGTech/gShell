# gShell
Interactive graphical desktop environment for LiveG OS.

Licensed by the [LiveG Open-Source Licence](LICENCE.md).

Documentation for gShell can be found on [LiveG Docs](https://docs.liveg.tech/?product=gshell&page=index.md). Releases for LiveG OS can be found in the [LiveG OS repository](https://github.com/LiveGTech/OS).

## Getting gShell
gShell relies on git submodules to make use of various LiveG-developed libraries when a device is offline. To clone the gShell repository, use:

```bash
git clone https://github.com/LiveGTech/gShell --recurse-submodules
```

It is important that when you pull the repo to update libraries, you use:

```bash
git pull --recurse-submodules
```

When you don't need to update the libraries, you can omit the `--recurse-submodules` argument. However, it is recommended that you update the libraries locally to ensure compatibility with the latest version of gShell.

## Running gShell
Install gShell and its dependencies using npm:

```bash
npm install
```

Run gShell on the local machine (in a simulated environment on non-LiveG OS systems), alongside any added arguments:

```bash
# On LiveG OS:
./gshell --real

# On Linux:
./gshell

# On other platforms:
npm run gshell
```

### Flags/arguments
Here's a list of arguments that can be supplied to gShell:

* `--no-touch-emulation`: Do not emulate a touchscreen as the touch input device. This is useful if the device that is running already has a touchscreen (emulation is not enabled when using the `--real` argument).
* `--device-desc-location`: Set the location of the [device description file](https://docs.liveg.tech/?product=gshell&page=device.md) to be used to the path specified.
* `--device-type`: Override the device description file's [`type` value](https://docs.liveg.tech/?product=gshell&page=device.md#type) with the value specified.
* `--allow-host-control`: Allow gShell to configure the host system's hardware configuration (such as Wi-Fi connections).
* `--enable-a11y-switch`: Force the [Switch Navigation](https://docs.liveg.tech/?product=gshell&page=a11y.md) accessibility feature to be enabled.
* `--im-emulation`: Emulate gShell being used as if it were booted on installation media.