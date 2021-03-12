# We create a public endpoint to listen in the hand-shake port of the event grid subscription.
ngrok http -host-header=localhost 9000
Write-Host "Use endpoint created in event-grid.binding.yaml as value of subscriberEndpoint before running the service speech-processor"