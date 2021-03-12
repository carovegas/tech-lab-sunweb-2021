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
const apiTokenURL = `https://${serviceRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

// Dapr
const daprPort = process.env.DAPR_HTTP_PORT || "3501";
const providerEndpoint = `http://localhost:${daprPort}/v1.0/invoke/provider/method/audio`;

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
  logger.debug("speech-processor req: " + JSON.stringify(body));

  if (isNewBlob(body)) {
    let url = body.data ? body.data.url : "";
    let lang = getLanguage(url);
    logger.debug("speech-processor url: " + url);
    logger.debug("speech-processor lang: " + lang);

    if (!url || !url.trim()) {
      res.status(400).send({ error: "url required" });
      return;
    }
    
    const token = await getToken();
    logger.debug(`API Token: ${token}`)

    if (!lang || !lang.trim()) {
      lang = "en-GB";
    }
    const responseFile = await fetch(url);
    if (!responseFile.ok) {
      const error = "Error downloading file: " + responseFile.error
      logger.error(error);
      res.status(500).send({ message: error });
    }

    const buffer = await responseFile.buffer();
    const transcription = await callCognitiveService(token, buffer, lang, res);
    logger.debug("Transcription: " + transcription);
    if (transcription === "")
    {
      res.status(500).send("Error, transcription is empty");
      return;
    }

    let obj = {
      id_str: Date.now().toString(),
      text: transcription,
      lang: lang,
      created_at: new Date().toJSON(),
      trace_state: req.get("tracestate"),
      trace_parent: req.get("traceparent"),
    };

    if (!sendToProvider(obj))
    {
      res.status(500).send({ error: "error invoking provider service" });
      return;
    }
    
    res.status(200).send("Everything OK!: " + transcription);
  }
  else {
    logger.debug("It is not new blob, speech-processor skipped");
  }

});

function isNewBlob(gridEvent) {
  return gridEvent.type === "Microsoft.Storage.BlobCreated" && gridEvent.data.api === "PutBlob"
}

function getLanguage(url) {
  var language = ""
  var urlParts = url.split("/");
  if (urlParts) {
    var name = urlParts[urlParts.length - 1]
    if (name.startsWith("uk-")) {
      language = "en-GB"
    }
    if (name.startsWith("nl-")) {
      language = "nl-NL"
    }
    if (name.startsWith("es-")) {
      language = "es-ES"
    }
  }

  return language;
}

async function sendToProvider(obj) {
  let response = await fetch(providerEndpoint, {
    method: "POST",
    body: JSON.stringify(obj),
    headers: {
      "Content-Type": "application/json",
      traceparent: obj.trace_parent,
      tracestate: obj.trace_state,
    },
  });

  if (!response.ok) {
    logger.error("error invoking provider service");
    return false;
  }

  return true;
};

async function callCognitiveService(token, buffer, lang, res) {
  const apiRequest = `${endpoint}/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&profanity=raw&diarizationEnabled=true&format=detailed`;

  logger.debug("Request to: " + apiRequest);
  // Call cognitive service
  let response = await fetch(apiRequest, {
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
    return "";
  }

  let responseJson = await response.json();
  const status = responseJson.RecognitionStatus;
  logger.debug(JSON.stringify(responseJson));
  if (status !== "Success") {
    logger.debug("Status failed from Cognitive: " +  status)
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
