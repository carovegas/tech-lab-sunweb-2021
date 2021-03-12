#!/bin/bash

set -o errexit
set -o pipefail

npm install

dapr run --app-id speech-processor --app-port 3003 --components-path ../../components -- node app.js