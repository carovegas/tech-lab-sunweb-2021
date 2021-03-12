go build handler.go main.go

dapr run --app-id viewer --dapr-http-port 3503 --app-port 8083 --components-path ../../components --config ../config.yaml --log-level debug -- go run handler.go main.go