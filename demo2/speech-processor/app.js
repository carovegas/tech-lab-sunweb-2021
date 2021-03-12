// This app is called by the provider to score the tweets using cognitive
// services. When this app starts Dapr registers its name so other services
// can use Dapr to call this service.
require("isomorphic-fetch");
let fs = require('fs')
const express = require("express");
const logger = require("./logger");
const bodyParser = require("body-parser");
const { response } = require("express");

// express
const port = 3003;
const app = express();
app.use(bodyParser.json());

// Cognitive Services API
// The KEY 1 value from Azure Portal, Keys and Endpoint section
const apiToken = process.env.CS_TOKEN || "25377d01457f43089df9c3e89b7ee1a9";

const serviceRegion = process.CS_SERVICEREGION || "westeurope";

// The Endpoint value from Azure Portal, Keys and Endpoint section
const endpoint = process.env.CS_ENDPOINT || `https://${serviceRegion}.stt.speech.microsoft.com`;

// The full URL to the speech service
const apiURL = `${endpoint}/speech/recognition/conversation/cognitiveservices/v1?language=nl-NL&profanity=raw&diarizationEnabled=true&format=detailed`;
const apiTokenURL = `https://${serviceRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

// Root get that just returns the configured values.
app.get("/", (req, res) => {
  logger.debug("speech endpoint: " + endpoint);
  logger.debug("speech apiURL: " + apiURL);
  res.status(200).json({
    message: "hi, nothing to see here, try => POST /speech-processor",
    endpoint: endpoint,
    apiURL: apiURL,
  });
});

app.post("/speech-processor", async (req, res) => {
  let body = req.body;
  let lang = body.lang;
  let text = body.text;
  logger.debug("speech-processor req: " + JSON.stringify(body));

  if (!text || !text.trim()) {
    res.status(400).send({ error: "text required" });
    return;
  }
  
  const token = await getToken();
  logger.debug(`API Token: ${token}`)

  if (!lang || !lang.trim()) {
    lang = "nl-NL";
  }

  const fileURL = "https://techlabinputblob.blob.core.windows.net/videos/0018612910-104053.wav";
  const responseFile = await fetch(fileURL);
  if (!responseFile.ok) {
    const error = "Error downloading file: " + responseFile.error
    logger.error(error);
    res.status(500).send({ message: error });
  }

  const buffer = await responseFile.buffer();
  const transcription = await callCognitiveService(token, buffer, lang, res);
  logger.debug("Transcription: " + transcription);
  if (transcription !== "") res.status(200).send("Everything OK!: " + transcription);
});

async function callCognitiveService(token, buffer, lang, res) {
  const apiRequest = `${endpoint}/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&profanity=raw&diarizationEnabled=true&format=detailed`;

  // Call cognitive service
  let response = await fetch(apiURL, {
    method: "POST",
    headers: {
      "Content-Type": "audio/wav;",
      "Ocp-Apim-Subscription-Key": apiToken,
      "Authorization": `Bearer ${token}`
    },
    body: buffer,
  });
  if (!response.ok) {
    logger.error("error invoking cognitive service");
    res.status(500).send({ error: "error invoking cognitive service" });
    return "";
  }

  let responseJson = await response.json();
  const status = responseJson.RecognitionStatus;
  logger.debug(JSON.stringify(responseJson));
  if (status !== "Success") {
    logger.debug("Status failed from Cognitive: " +  status)
    res.status(500).send({ error: "error invoking cognitive service" });
    return "";
  }

  return responseJson.NBest[0].Display;
}

async function getToken() {
  let response = await fetch(apiTokenURL, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiToken
      },
  });
  if (!response.ok) {
    logger.error("error invoking getting token");
  }
  return await response.text();
};

// Make sure we have all the required information
if (apiToken == "" || endpoint == "") {
  logger.error("you must set CS_TOKEN and CS_ENDPOINT environment variables");
  throw new Error(
    "you must set CS_TOKEN and CS_ENDPOINT environment variables"
  );
} else {
  logger.debug("CS_TOKEN: " + apiToken);
  logger.debug("CS_ENDPOINT: " + endpoint);
}

app.listen(port, () => logger.info(`Node App listening on port ${port}!`));
