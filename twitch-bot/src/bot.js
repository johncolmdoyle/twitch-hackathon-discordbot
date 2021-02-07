require('dotenv').config()

const tmi = require('tmi.js');

const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true
  },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN
  },
  channels: [ process.env.TWITCH_CHANNEL ]
});

client.connect();

client.on('message', (channel, tags, message, self) => {
  console.log(`${tags['display-name']}: ${message}`);

  // Ignore echoed messages.
  if(self) return;

  if(message.toLowerCase() === '!hello') {
    client.whisper(tags.username, "Yo yo yo");
  }
});

client.on("whisper", (from, userstate, message, self) => {
    // Don't listen to my own messages..
    if (self) return;

    console.log(JSON.stringify(from));
    console.log(JSON.stringify(userstate));
    console.log(JSON.stringify(message));
});
