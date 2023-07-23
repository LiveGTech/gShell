#!/bin/bash

# gShell
# 
# Copyright (C) LiveG. All Rights Reserved.
# 
# https://liveg.tech
# Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.

pv -n $1 | tar -xzf - -C $2