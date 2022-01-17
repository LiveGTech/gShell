# gShell
Interactive graphical desktop environment for LiveG OS.

Licenced by the [LiveG Open-Source Licence](LICENCE.md).

## Getting gShell
gShell relies on git submodules to make use of various LiveG-developed libraries when a device is offline. To clone the gShell repository, use:

```bash
git clone https://github.com/LiveGTech/gShell --recurse-submodules
```

It is important that when you pull the repo to update libraries, you use:

```bash
git pull --recurse-submodules
```

When you don't need to update the libraries, you can omit the `--recurse-submodules` argument. However, if you have cloned this repository before we added submodules, you must run `git submodules init` and then `git pull --recurse-submodules` to clone the required submodules to run gShell.

## Running gShell
Install gShell and its dependencies using npm:

```bash
npm install
```

Run gShell on the local machine (in a simulated environment on non-LiveG OS systems):

```bash
# On LiveG OS:
./gshell --real

# On Linux:
./gshell

# On other platforms:
npm run gshell
```