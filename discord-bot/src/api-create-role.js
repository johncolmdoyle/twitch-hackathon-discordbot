require('dotenv').config()
const Discord = require('discord.js');
const AWS = require('aws-sdk');

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';
const SORT_KEY = process.env.SORT_KEY || '';

const FUNCTION_KEY = 'discord';

const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context, callback) => {
    if (!event.body) {
        return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
    }

    const requestData = typeof event.body == 'object' ? event.body : JSON.parse(event.body);

    if (!requestData.broadcasterUserId) {
        return { statusCode: 400, body: 'invalid request, you are missing the "broadcasterUserId" key' };
    }

    if (!requestData.guildId) {
        return { statusCode: 400, body: 'invalid request, you are missing the "guildId" key' };
    }

    if (!requestData.roleName) {
        return { statusCode: 400, body: 'invalid request, you are missing the "roleName" key' };
    }

    if (!requestData.roleColor) {
        return { statusCode: 400, body: 'invalid request, you are missing the "roleColor" key' };
    }

    const client = new Discord.Client();

    let discordBotToken = "";
    let response = "";

    let keyData = {};
    keyData[PRIMARY_KEY] = requestData.broadcasterUserId;
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

    await client.login(discordBotToken);

    let guild = await client.guilds.fetch(requestData.guildId);

    await guild.roles.create({
        data: {
            name: requestData.roleName,
            color: requestData.roleColor,
        },
        reason: 'Twitch Channel Point Reward',
    });

    let serverDetailList = [];
    let roleDetailList = [];

    client.guilds.cache.forEach(g => {
        let serverDetails = {};
        serverDetails['id'] = g.id;
        serverDetails['name'] = g.name;
        serverDetailList.push(serverDetails);
    });

    for (let i = 0; i < serverDetailList.length; i++) {
        let guild = await client.guilds.fetch(serverDetailList[i].id);
        const roleList = await guild.roles.fetch();

        roleList.cache.forEach(r => {
            let roleDetails = {};
            roleDetails['guildId'] = serverDetailList[i].id;
            roleDetails['id'] = r.id;
            roleDetails['name'] = r.name;
            roleDetails['rawPosition'] = r.rawPosition;
            roleDetailList.push(roleDetails);
        });
    }

    response.Item['serverList'] = serverDetailList;
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
        return { statusCode: 500, body: dbError };
    }
};
