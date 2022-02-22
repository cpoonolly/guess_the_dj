// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');

// Creates a client
const storage = new Storage();

/**
 * Responds to a play request.
 */
exports.play = (req, res) => {
  let message = {text: "Hello play"};

  res.status(200).send(JSON.stringify(message));
};

/**
 * Responds to a reveal request.
 */
 exports.reveal = (req, res) => {
  let message = {text: "Hello reveal"};
  res.status(200).send(JSON.stringify(message));
};

/**
 * Responds to a submit request.
 */
 exports.submit = (req, res) => {
  let message = {text: "Hello submit"};
  res.status(200).send(JSON.stringify(message));
};

/**
 * Responds to a guess request.
 */
 exports.guess = (req, res) => {
  let message = {text: "Hello guess"};
  res.status(200).send(JSON.stringify(message));
};
