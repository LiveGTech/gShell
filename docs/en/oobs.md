# Out-of-box setup system (OOBS)
The OOBS is shown during the installation phase of LiveG OS, and when LiveG OS is being used for the first time. It allows users to configure the system's mandatory settings and how they with to install LiveG OS. End-user information on how to [install LiveG OS to a device](https://docs.liveg.tech/?product=os&page=install.md) and how to [set up LiveG OS](https://docs.liveg.tech/?product=os&page=setup.md) can be found in the docs for LiveG OS.

## Note on rendering OOBS feature media videos
Feature media videos for the OOBS are WebM files that contain alpha transparency. To render these videos, configure Synfig Studio to render as a sequence PNG files (set **target** to be **png**) to the `media/oobs/renders` directory, and then run the following command in that directory (where `$NAME` is the name of the feature media, such as `installask`):

```bash
$ ffmpeg -framerate 60 -f image2 -i $NAME.%04d.png -c:v libvpx-vp9 $NAME.webm
```

This should then produce a WebM file that should be placed in the `shell/media/oobs` directory.