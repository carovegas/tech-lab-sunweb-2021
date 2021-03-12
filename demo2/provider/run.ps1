npm install

dapr run --app-id provider --dapr-http-port 3501 --app-port 3001 --components-path ../../components --config ../config.yaml --log-level debug -- node app.js