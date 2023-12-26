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
Before running gShell, you will need to install its dependencies:

```bash
sudo apt install make gcc g++

# Run these if you don't have Node.js installed:
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20.5.1

# To run `gshell-xephyr` (optional):
 sudo apt install xserver-xephyr
``` 

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
* `--allow-xorg-window-management`: Allow gShell to act as an Xorg compositing window manager.
* `--enable-a11y-switch`: Force the [Switch Navigation](https://docs.liveg.tech/?product=gshell&page=a11y.md) accessibility feature to be enabled.
* `--im-emulation`: Emulate gShell being used as if it were booted on installation media.

## Building gShell
To build gShell, first install the dependencies:

```bash
sudo apt install libx11-dev gcc-aarch64-linux-gnu g++-aarch64-linux-gnu gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf
```

Then run the builder:

```bash
npm run dist
```

The built AppImage files will be available in the `dist` folder.

### Building included C libraries
gShell includes C libraries that are used internally for low-level access to the system. An example is `libgslai`, which is the library for gShell Linux app integration, and whose source can be found at `src/csrc/libgslai.c`.

The C libraries are automatically compiled for each platform when running `npm run dist`.

To force a rebuild of the C libraries by running:

```bash
./buildclibs --force
```
