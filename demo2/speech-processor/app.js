// This app is called by the provider to score the tweets using cognitive
// services. When this app starts Dapr registers its name so other services
// can use Dapr to call this service.
require("isomorphic-fetch");
const express = require("express");
const logger = require("./logger");
const bodyParser = require("body-parser");

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

app.post("/sentiment-score", (req, res) => {
  let body = req.body;
  let lang = body.lang;
  let text = body.text;
  logger.debug("sentiment req: " + JSON.stringify(body));

  if (!text || !text.trim()) {
    res.status(400).send({ error: "text required" });
    return;
  }

  if (!lang || !lang.trim()) {
    lang = "en";
  }

  const reqBody = {
    documents: [
      {
        id: "1",
        language: lang,
        text: text,
      },
    ],
  };

  // Call cognitive service to score the tweet
  fetch(apiURL, {
    method: "POST",
    body: JSON.stringify(reqBody),
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": apiToken,
    },
  })
    .then((_res) => {
      if (!_res.ok) {
        res.status(400).send({ error: "error invoking cognitive service" });
        return;
      }
      return _res.json();
    })
    .then((_resp) => {
       // Send the response back to the other service.
      const result = _resp.documents[0];
      logger.debug(JSON.stringify(result));
      res.status(200).send(result);
    })
    .catch((error) => {
      logger.error(error);
      res.status(500).send({ message: error });
    });
});

app.post("/speech-processor", (req, res) => {
  let body = req.body;
  let lang = body.lang;
  let text = body.text;
  logger.debug("speech-processor req: " + JSON.stringify(body));

  if (!text || !text.trim()) {
    res.status(400).send({ error: "text required" });
    return;
  }

  var token = "";
  fetch(apiTokenURL, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiToken
    },
    })
    .then((_res) => {
      if (!_res.ok) {
        res.status(400).send({ error: "error invoking getting token" });
        return;
      }
      return _res.text()
    })
    .then((_token) => {
      token = _token;
      logger.debug(`API Token: ${token}`)
    })
    .catch((error) => {
      logger.error(error);
      res.status(500).send({ message: error });
  });
  
  logger.debug(`API Token1: ${token}`)

  const token2 = getToken();
  logger.debug(`API Token2: ${token2}`)

/*  scoreSentiment(obj)
    .then(saveContent)
    .then(publishContent)
    .then(function (rez) {
      logger.debug("rez: " + JSON.stringify(rez));
      res.status(200).send({});
    })
    .catch(function (error) {
      logger.error(error.message);
      res.status(500).send(error);
    });*/
  
  if (!lang || !lang.trim()) {
    lang = "en";
  }

/*
  const reqBody = {
    documents: [
      {
        id: "1",
        language: lang,
        text: text,
      },
    ],
  };

  // Call cognitive service to score the tweet
  fetch(apiURL, {
    method: "POST",
    body: JSON.stringify(reqBody),
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": apiToken,
    },
  })
    .then((_res) => {
      if (!_res.ok) {
        res.status(400).send({ error: "error invoking cognitive service" });
        return;
      }
      return _res.json();
    })
    .then((_resp) => {
       // Send the response back to the other service.
      const result = _resp.documents[0];
      logger.debug(JSON.stringify(result));
      res.status(200).send(result);
    })
    .catch((error) => {
      logger.error(error);
      res.status(500).send({ message: error });
    });
*/
});

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
