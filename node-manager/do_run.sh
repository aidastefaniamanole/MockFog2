#!/bin/bash

# node app.js bootstrap
# python3 get_macs.py
node app.js agent
node app.js manipulate
node app.js prepare
node app.js start
node app.js orchestrate
node app.js stop
node app.js collect