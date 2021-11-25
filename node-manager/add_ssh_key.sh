#!/bin/bash

KEY_FILE=./keys/id_rsa

mkdir keys
ssh-keygen -t rsa -f $KEY_FILE -C $1

# !!! Adding a new key erases any existing keys !!!
gcloud compute project-info add-metadata --metadata=ssh-keys="$1:$(cat "$KEY_FILE.pub")"