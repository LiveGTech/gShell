# Filesystem
The gShell filesystem is a subset of the LiveG OS filesystem; the LiveG OS filesystem contains not just gShell's storage data, but also the files for the supporting infrastructure that allows gShell to operate correctly. On LiveG OS, gShell's filesystem is located under the `/system/storage` path, but in the simulator, the filesystem is located under `~/gShell/storage` (`~` denoting the host's user directory).

gShell abstracts away the complexities of where its filesystem is located in the host's own filesystem by exposing the `storage://` protocol. On LiveG OS, this points to `/system/storage`.

## Paths
`storage://` (the root) is used to store global data such as config files that apply to all users. This may be, for example, where the list of users on the system is stored.

`storage://users` is the location of the various user folders, where each user folder is named after the ID of a user. This folder is where user data can be stored. Directly inside of this folder, user-specific config files are stored, such as for theming and personalisation, as well as authentication.

`storage://users/<uid>/files` is where the user's own files can be stored and arranged freely by the user. The default folder structure given to the user is:

* `storage://users/<uid>/files/Downloads`: Where downloads from the internet are stored.
* `storage://users/<uid>/files/Photos`: Where the user's photos and videos are stored. Each subfolder is treated as a photo album.
* `storage://users/<uid>/files/Photos/Camera`: Where photos and videos taken by the device's camera are stored.
* `storage://users/<uid>/files/Photos/Screenshots`: Where screenshots taken by the user are stored.

## Where are apps and their respective data stored?
Apps and their respective data are not stored in the gShell filesystem, but _are_ stored in the host system's filesystem. Since apps are web apps, they may choose to be stored in Electron's cache so that they can be used when the device is offline.

Apps can make use of web APIs such as the HTML Web Storage API (`localStorage`), the IndexedDB API and the Cache API to store app-specific data, in addition to being able to access the user's `files` folder to store files, subject to an API exposed by gShell, and that permission must be granted by the user to do so.