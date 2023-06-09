# System updates
The update system is responsible for downloading and installing packages and files that bring feature additions and improvements, bug fixes and security patches to LiveG OS without requiring LiveG OS to be reinstalled.

## Update index
For LiveG OS to discover what updates are available, an update index is hosted online at [liveg.tech/os/updates/index.json](https://liveg.tech/os/updates/index.json). The index file is PGP signed, and the signature is stored at [liveg.tech/os/updates/index.json.sig](https://liveg.tech/os/updates/index.json.sig).

The update index contains metadata about the update which is shown to the user (such as the update description), as well as information on update compatibility and references to the packages and files that need to be downloaded and installed.

Here is an example of the update index file:

```json
{
    "updates": [
        {
            "version": "0.3.0",
            "vernum": 4,
            "circuit": "beta",
            "description": {
                "en_GB": "This update includes the ability to install web apps and add them to the home screen and app menu.",
                "fr_FR": "Cette mise à jour inclut la possibilité d'installer des applications web et de les ajouter à l'écran d'accueil et le menu des applications."
            },
            "fallbackLocale": "en_GB",
            "minSupportedVernum": 1,
            "minRecommendedVernum": 1,
            "supportedPlatforms": [
                "x86_64",
                "arm64",
                "pinephone",
                "rpi"
            ],
            "packages": [
                {
                    "name": "liveg-hello",
                    "version": "0.1.0"
                },
                {
                    "name": "eg25-manager:arm64=0.4.6",
                    "arch": "arm64",
                    "version": "0.4.6-1",
                    "condition": "['pinephone', 'prism'].includes(platform)"
                }
            ],
            "preinstallScriptPath": "preinstall.sh",
            "postinstallScriptPath": "postinstall.sh",
            "rebootScriptPath": "reboot.sh",
            "rollbackScriptPath": "rollback.sh",
            "files": [
                {
                    "path": "gshell-arm64.AppImage",
                    "destinationPath": "/system/bin/gshell-update.AppImage",
                    "condition": "['pinephone', 'prism', 'arm64'].includes(platform)"
                },
                {
                    "path": "xload.sh"
                },
                {
                    "path": "device-prism.gsc",
                    "destinationPath": "/system/storage/device.gsc",
                    "condition": "platform == 'prism'"
                }
            ],
            "releasedAt": 1686332027296,
            "archivePath": "1.tar.gz",
            "archiveMethod": "tarGzip",
            "archiveHash": "5902362733ec4fdeb2382da644ec0d537818b57a1ec58cb11eeee69628270297",
            "archiveHashMethod": "sha256",
        }
    ]
}
```

## Update archive
The update archive contains all the files needed to perform the update, including the scripts to run and the files to be copied. This archive is downloaded at the time of updating to `storage://update.tar.gz` (in the case of a gzipped tarball), and subsequently extracted to the `storage://update` folder. The archive and folder are deleted after update completion to save storage space.

## Packages
System packages are updated and installed using Debian's APT package manager. Packages are first downloaded before they are installed, ensuring that the update can be cancelled before the installation stage.

### Update scripts
Update scripts are used to implement special logic to the update system that is not already implemented in gShell. These scripts are executed at different stages, depending on where they are referenced in the update index:

* The script referenced by **`preinstallScript`** is executed after archive extraction and before package installation.
* The script referenced by **`postinstallScript`** is executed after copying files is complete and before the system is restarted.
* The script referenced by **`rebootScript`** is executed after the system has restarted and the previous update steps have executed successfully. It does not have access to the update environment variables.
* The script referenced by **`rollbackScript`** is executed after the system has restarted and the previous update steps have not executed successfully, or if the system has restarted after an unexpected shutdown. It does not have access to the update environment variables.

## Installation steps
The steps taken to perform the installation are the following:

1. Wait for user to visit updates page in Settings (or continue if auto-updating is enabled)
2. Download update index file (which contains the list of available updates)
3. Download applicable update config file (a config file that represents an update to a system that is newer than the current system)
4. Calculate total update size by requesting HTTP headers of files to download and by running `apt-cache show --no-all-versions` for each package to download
5. Wait for user to choose option to start downloading latest update (or continue if auto-updating is enabled)
6. Perform an `apt-get update`
7. Download the update archive which contains the gShell AppImage, scripts and files listed in update config file
8. Run the pre-install script (if present)
9. Download the listed APT packages by using `apt-get install --download-only`
10. Copy the latest gShell AppImage and associated files to their respective locations
11. Run the post-install script (if present)
12. Reboot the system
13. Run the reboot script (`reboot.sh`)
14. Copy gShell staged update AppImage to working AppImage
15. Start gShell

## Variables
Here is a list of variables that are available for evaluation of conditions in the update index file, as well as their equivalent in scripts as environment variables:

| Update index name | Script name | Description |
|---|---|---|
| `platform` | `$PLATFORM` | The name of the platform (for example, `"x86_64"`) |
| `modelCodename` | `$MODEL_CODENAME` | The codename of the device model (listed in [DDF](https://docs.liveg.tech/?product=gshell&page=device.md); for example, `"prism"`) |
| `vernum` | `$VERNUM` | The new version number integer for the update (for example, `4`) |
| `version` | `$VERSION` | The new version string for the update (for example, `0.3.0`) |
| `oldVernum` | `$OLD_VERNUM` | The version number integer for the current system (for example, `1`) |
| `oldVersion` | `$OLD_VERSION` | The version string for the current system (for example, `0.2.0`) |

## Durability
This update system has been designed with durability in mind to help protect LiveG OS from entering a bad, unrecoverable state in the event of an unscheduled system shutdown. As such, the download process must not interfere with the system configuration and so can be cancellable by the user. After the download process is complete, the installation process cannot be cancelled by the user as it alters the system state, but there will still be protections in place should anything unexpected happen. During the installation process, the user is advised to not power off their device.

Before the installation process commences, the rollback script will be copied to `/system/scripts/update-rollback.sh` and the file `/system/gshell-staging-rollback` will be created. The presence of this file indicates to the startup script that the system may need recovering and rolling back after an unexpected event occurred. Should this file exist, the rollback script will be executed. Otherwise, the `gshell-staging-rollback` file will be deleted at the end of the installation process if it was successful.

To prevent any potential data loss when copying the gShell AppImage, the AppImage will be copied to `/system/bin/gshell-update.AppImage`, which essentially stages it to replace the current `gshell.AppImage`. The startup script is responsible for replacing `gshell.AppImage` with `gshell-update.AppImage` through renaming the files to make the process more atomic and less prone to data loss. This should only occur when the rollback script has not been executed.

## Security considerations
APT does employ package signing, so we can rely on this to ensure that packages aren't modified through MITM attacks. However, we must ensure that all packages and package lists are downloaded over HTTPS to take advantage of SSL.

To prevent the download of malicious update files from the LiveG website as a result of potential tampering, we can make use of PGP file signing, and verify the files within LiveG OS to ensure they are trusted files from LiveG.