require('dotenv').config()
const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  let user = client.users.cache.find(user => user.username == "artwolf");
  console.log(JSON.stringify(user));
  
  if (msg.guild.me.hasPermission('MANAGE_ROLES')) {
    const role = msg.member.guild.roles.cache.find(role => role.name === "Level 1");
    const member = msg.guild.member(msg.author);

    if (role) {
      msg.guild.members.cache.get(msg.author.id).roles.add(role);
      process.exit();
    }
  } else {
    console.log("No permission..");
  }
});

client.login(process.env.DISCORDJS_BOT_TOKEN);
