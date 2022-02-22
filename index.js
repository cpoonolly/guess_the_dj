// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');
const dayjs = require('dayjs')

const BUCKET_NAME = 'cpoonolly-dev.appspot.com';
const APP_FOLDER = 'guess_the_dj';
const DAILY_SONG_FOLDER = 'daily_song';
const DAILY_GUESSES_FOLDER = 'daily_guesses';
const SUGGESTED_SONGS_FOLDER = 'suggested_songs';

const storage = new Storage({
  projectId: 'cpoonolly-dev'
});

// Google Cloud Storage functions

const listFileNames = async (prefix, showSubDirectories = false) => {
  const options = {prefix};

  if (!showSubDirectories) {
    options.delimiter = '/';
  }

  const [files] = await storage.bucket(BUCKET_NAME).getFiles(options);

  return files.map(file => file.name.substring(prefix.length)).filter(file => file.length > 0);
};

const writeFile = async (filename, data) => {
  await storage.bucket(BUCKET_NAME).file(filename).save(JSON.stringify(data));
};

const readFile = async (filename) => {
  const data = await storage.bucket(BUCKET_NAME).file(filename).download();

  return JSON.parse(data);
};

const deleteFile = async (filename) => {
  await storage.bucket(BUCKET_NAME).file(filename).delete();
};

const fileExists = async (filename) => {
  const [exists] = await storage.bucket(BUCKET_NAME).file(filename).exists();
  return exists
}


// Utils

const chooseRandomly = (items) => items[Math.floor(Math.random() * items.length)];


// Model Utils

const listSongSuggestionsForUser = async (user) => {
  return await listFileNames(`${APP_FOLDER}/${SUGGESTED_SONGS_FOLDER}/${user}/`);
};

const listUsersWithSongSuggestions = async () => {
  const suggestionFiles = await listFileNames(`${APP_FOLDER}/${SUGGESTED_SONGS_FOLDER}/`, true);

  return Array.from(new Set(
    suggestionFiles
        .map(file => file.split('/'))
        .filter(fileParts => fileParts.length > 1)
        .map(fileParts => fileParts[0])
  ));
};

const getSongSuggestion = async (user, song) => {
  return await readFile(`${APP_FOLDER}/${SUGGESTED_SONGS_FOLDER}/${user}/${song}`);
};

const addSongSuggestion = async (user, name, url) => {
  const timestamp = dayjs().format();
  const fileName = `song_suggestion_${timestamp}`;
  const fileData = {user, name, url, timestamp};
  await writeFile(`${APP_FOLDER}/${SUGGESTED_SONGS_FOLDER}/${user}/${fileName}`, fileData);
};

const removeSongSuggestion = async (user, song) => {
  return await deleteFile(`${APP_FOLDER}/${SUGGESTED_SONGS_FOLDER}/${user}/${song}`);
};

const addDailySong = async (date, songData) => {
  const fileName = `daily_song_${date}`;
  return await writeFile(`${APP_FOLDER}/${DAILY_SONG_FOLDER}/${fileName}`, songData);
};

const getDailySong = async (date) => {
  const fileName = `daily_song_${date}`;
  return await readFile(`${APP_FOLDER}/${DAILY_SONG_FOLDER}/${fileName}`);
}

const isDailySongChoosen = async (date) => {
  const fileName = `daily_song_${date}`;
  return await fileExists(`${APP_FOLDER}/${DAILY_SONG_FOLDER}/${fileName}`);
};

const setDailySongRevealed = async (date, user, name) => {
  const fileName = `daily_song_${date}_revealed`;
  return await writeFile(`${APP_FOLDER}/${DAILY_SONG_FOLDER}/${fileName}`, {user, name});
};

const getDailySongRevealedBy = async (date) => {
  const fileName = `daily_song_${date}_revealed`;
  return await readFile(`${APP_FOLDER}/${DAILY_SONG_FOLDER}/${fileName}`);
}

const isDailySongRevealed = async (date) => {
  const fileName = `daily_song_${date}_revealed`;
  return await fileExists(`${APP_FOLDER}/${DAILY_SONG_FOLDER}/${fileName}`);
};

const addGuess = async (date, user, name, guess, guessName) => {
  const fileName = `daily_guess_${date}_${user}`;
  const fileData = {user, name, guess, guessName};
  return await writeFile(`${APP_FOLDER}/${DAILY_GUESSES_FOLDER}/${fileName}`, fileData);
};

const hasGuess = async (date, user) => {
  const fileName = `daily_guess_${date}_${user}`;
  return await fileExists(`${APP_FOLDER}/${DAILY_GUESSES_FOLDER}/${fileName}`);
};

const getGuesses = async (date) => {
  const usersWithGuesses = await listFileNames(`${APP_FOLDER}/${DAILY_GUESSES_FOLDER}/daily_guess_${date}_`);
  const guesses = await Promise.all(usersWithGuesses.map(
    (user) => readFile(`${APP_FOLDER}/${DAILY_GUESSES_FOLDER}/daily_guess_${date}_${user}`)
  ));

  return guesses;
};

// Command Endpoints

/**
 * Play today's song.
 * Called when the `/song_play` slack command is executed.
 */
exports.playSong = async (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  let message;
  
  try {
    if (!(await isDailySongChoosen())) {
      throw Error('DJ not choosen yet. Please run `\\dj_choose` to choose today\'s DJ.');
    }

    const {url} = await getDailySong(today);
    message = {text: `Today's song: ${url}`, response_type: 'in_channel'};

  } catch (err) {
    message = {text: err.message, response_type: 'ephemeral'}
  }

  res.setHeader('content-type', 'application/json');
  res.status(200);
  res.send(message);
  res.end();
};

/**
 * Add a song suggestion for the current user.
 * Called when the `/song_suggest <song url>` slack command is executed.
 */
 exports.suggestSong = async (req, res) => {
  const {user_id: user, user_name: name, text: url} = req.body;
  await addSongSuggestion(user, name, url);

  res.status(200).send({text: "Song suggestion added!", response_type: 'ephemeral'});
};

/**
 * Choose a DJ for today.
 * Called when the `/dj_choose` slack command is executed.
 */
 exports.chooseDJ = async (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  let message;

  try {
    // Check that we haven't choosen a dj yet
    if (await isDailySongChoosen(today)) {
      throw Error('DJ has already been choosen for today.');
    }

    // Choose a dj
    const users = await listUsersWithSongSuggestions();
    if (users.length <= 0) {
      throw Error('No songs suggested. Please run `\\song_suggest` to add some.')
    }

    const dj = chooseRandomly(users);

    // Pick a song suggestion from today's dj
    const songSugggestions = await listSongSuggestionsForUser(dj);
    const songSuggestion = chooseRandomly(songSugggestions);

    // Add a file for today's daily song
    const songData = await getSongSuggestion(dj, songSuggestion);
    await addDailySong(today, songData);

    // Remove song suggestion from dj's suggestions folder
    await removeSongSuggestion(dj, songSuggestion);

    message = {
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {type: 'mrkdown', text: 'A DJ has been choosen!'}
        },
        {
          type: 'section',
          text: {type: 'mrkdown', text: 'Run `\\song_play` to hear today\'s song.'}
        },
        {
          type: 'section',
          text: {type: 'mrkdown', text: 'Run `\\dj_guess` to guess who\'s today\'s DJ.'}
        },
        {
          type: 'section',
          text: {type: 'mrkdown', text: 'Run`\\dj_reveal` to reveal today\'s DJ & everyone\'s guesses.'}
        }
      ]
    }
  } catch (err) {
    message = {text: err.message, response_type: 'ephemeral'};
  }

  res.setHeader('content-type', 'application/json');
  res.status(200);
  res.send(message);
  res.end();
};

/**  
 * Reveal today's DJ, along with everyone's guesses.
 * Called when the `/dj_reveal` slack command is executed.
 */
 exports.revealDJ = async (req, res) => {
  let message;
  const today = dayjs().format('YYYY-MM-DD');
  const {user_id: user, user_name: name} = req.body;

  try {
    // Check if today's dj has been choosen
    if (!(await isDailySongChoosen())) {
      throw Error('DJ not choosen yet. Please run `\\dj_choose` to choose today\'s DJ.');
    }

    // Check if today's dj has already been revealed. If yes return who revealed it.
    if (await isDailySongRevealed(today)) {
      const {name: revealedBy} = await getDailySongRevealedBy(today);
      throw Error(`Daily song already revealed by ${revealedBy}`);
    }

    // Mark the daily song as revealed
    await setDailySongRevealed(today, user, name);

    // Get the dj from today's daily song
    const {user: dj, name: djName} = await getDailySong(today);

    // Get guesses
    const guesses = await getGuesses(today);

    message = {
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {type: 'mrkdown', text: `Today's DJ is ${djName}!!!`}
        },
        ...guesses.map(({user, name, guess, guessName}) => ({
          type: 'section',
          text: {type: 'mrkdown', text: `${name} guessed ${guessName}! ${user === guess ? ':white_check_mark:' : ':x:'}`}
        }))
      ]
    };
  } catch (err) {
    message = {text: err.message, response_type: 'ephemeral'}
  }

  res.setHeader('content-type', 'application/json');
  res.status(200);
  res.send(message);
  res.end();
};

/** 
 * Guess today's DJ.
 * Called when the `/dj_guess @username` slack command is executed.
 */
 exports.guessDJ = async (req, res) => {
  let message;
  const today = dayjs().format('YYYY-MM-DD');
  const {user_id: user, user_name: name, text: guessStr} = req.body;

  try {
    // Check if the user has already guessed today
    if (await hasGuess(today, user)) {
      throw Error('You have already guessed today!');
    }

    // Parse the guess from the given text
    const guessRegex = /\<\@([A-Za-z0-9]+)\|*([A-Za-z0-9\s]*)\>/g;
    const guessRegexMatches = Array.from(guessStr.matchAll(guessRegex));
    if (guessRegexMatches.length < 1 || guessRegexMatches[0].length < 3) {
      throw Error('Invalid guess. Please use the following syntax: `\\dj_guess @username`')
    }

    const guess = guessRegexMatches[0][1];
    const guessName = guessRegexMatches[0][2];

    // Add the guess
    await addGuess(today, user, name, guess, guessName);

    message = {text: 'Guess Added!', response_type: 'ephemeral'};
  } catch (err) {
    message = {text: err.message, response_type: 'ephemeral'}
  }

  res.setHeader('content-type', 'application/json');
  res.status(200);
  res.send(message);
  res.end();
};
