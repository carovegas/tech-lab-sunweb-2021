npm install

dapr run --app-id speech-processor --app-port 3003 --components-path ../../components --config ../config.yaml --log-level debug -- node ./app.js