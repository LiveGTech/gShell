#!/bin/bash

# gShell
# 
# Copyright (C) LiveG. All Rights Reserved.
# 
# https://liveg.tech
# Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.

pushd $(dirname -- ${BASH_SOURCE[0]})
    mkdir -p renders
    synfig $(pwd)/$1.sifz -t png -o $(pwd)/renders/$1.png
    ffmpeg -y -framerate 60 -f image2 -i renders/$1.%4d.png -c:v libvpx-vp9 -pix_fmt yuva420p renders/$1.webm
popd