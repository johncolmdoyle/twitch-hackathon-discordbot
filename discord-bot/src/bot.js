require('dotenv').config()
const Discord = require('discord.js');
const AWS = require('aws-sdk');

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';
const SORT_KEY = process.env.SORT_KEY || '';

const FUNCTION_KEY = 'discord';

const db = new AWS.DynamoDB.DocumentClient();

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

exports.handler = async (event, context, callback) => {
  const client = new Discord.Client();
  
  let discordBotToken = "";
  let broadcaster_user_id = "";
  let response = "";

  for (const record of event.Records) {
    let keyData = {};
    broadcaster_user_id = record.dynamodb.NewImage.broadcaster_user_id.S;
    keyData[PRIMARY_KEY] = broadcaster_user_id;
    keyData[SORT_KEY] = FUNCTION_KEY;

    const params = {
      TableName: TABLE_NAME,
      Key: keyData
    };

    try {
      response = await db.get(params).promise();
      discordBotToken = response.Item.botToken;
    } catch (dbError) {
      console.log(JSON.stringify(dbError));
    }
  }

  await client.login(discordBotToken);
  
  for (const record of event.Records) {
    const type = record.dynamodb.NewImage.type.S;

    if (type == 'getServers') {
      let serverDetailList = [];
      client.guilds.cache.forEach(g => {  
        let serverDetails = {};
        serverDetails['id'] = g.id;
        serverDetails['name'] = g.name;
        serverDetailList.push(serverDetails);
      });

      response.Item['serverList'] = serverDetailList;

      const params = {
        TableName: TABLE_NAME,
        Item: response.Item
      };

      try {
        await db.put(params).promise();
  
        return { statusCode: 200, body: response.Item };
      } catch (dbError) {
        console.log(JSON.stringify(dbError));
        const errorResponse = dbError;
        return { statusCode: 500, body: errorResponse };
      }
    }
    if (type == 'getRoles') {
      const guildId = record.dynamodb.NewImage.guildId.S;
      
      let guild = await client.guilds.fetch(guildId);

      const roleList = await guild.roles.fetch();
      
      const roleDetailList = [];
      roleList.cache.forEach(r => {  
        let roleDetails = {};
        roleDetails['guild'] = guild;
        roleDetails['id'] = r.id;
        roleDetails['name'] = r.name;
        roleDetails['rawPosition'] = r.rawPosition;
        roleDetailList.push(roleDetails);
      });

      let item = {};

      response.Item['roleList'] = roleDetailList;

      const params = {
        TableName: TABLE_NAME,
        Item: response.Item
      };

      try {
        await db.put(params).promise();
  
        return { statusCode: 200, body: response.Item };
      } catch (dbError) {
        console.log(JSON.stringify(dbError));
        const errorResponse = dbError;
        return { statusCode: 500, body: errorResponse };
      }
    }
  }
};
