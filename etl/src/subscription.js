require('dotenv').config()

const got = require('got');

const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();
const {"v4": uuidv4} = require('uuid');

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';
const SORT_KEY = process.env.SORT_KEY || '';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const TWITCH_CALLBACK = process.env.TWITCH_CALLBACK || '';
const TWITCH_EVENT_SUB_SECRET = process.env.TWITCH_EVENT_SUB_SECRET || '';
const TWITCH_SUBSCRIPTION_API_URL = 'https://api.twitch.tv/helix/eventsub/subscriptions';

const getAppToken = async () => {
  const url = "https://id.twitch.tv/oauth2/token?" +
                "client_id=" + TWITCH_CLIENT_ID + "&" +
                "client_secret=" + TWITCH_CLIENT_SECRET + "&" +
                "grant_type=client_credentials";

  return await got.post(url, { responseType: 'json' })
    .then(res => res.body.access_token)
    .catch(err => {
      console.warn(err);
      return false;
    });
};

exports.handler = async (event, context, callback) => {
  if (!event.body) {
    return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
  }
  console.log("Body provided");

  const requestData = typeof event.body == 'object' ? event.body : JSON.parse(event.body);

  if (!requestData.type) {
    return { statusCode: 400, body: 'invalid request, you are missing the "type" key' };
  }

  console.log("type provided");

  if (!requestData.broadcasterUserId) {
    return { statusCode: 400, body: 'invalid request, you are missing the "broadcasterUserId" key' };
  }

  console.log("broadcasterUserId provided");

  const token = await getAppToken();

  if (!token) {
    return { statusCode: 500, body: 'Error obtaining App token' };
  }

  console.log("token validated");

  const options = {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    responseType: 'json'
  };

  const subscribe = async () => {
    console.log("Inside subscribe");

    const body = {
      type: 'channel.follow',
      version: '1',
      condition: {
        broadcaster_user_id: requestData.broadcasterUserId
      },
      transport: {
        method: 'webhook',
        callback: TWITCH_CALLBACK,
        secret: TWITCH_EVENT_SUB_SECRET
      }
    };

    return await got.post(TWITCH_SUBSCRIPTION_API_URL, { ...options, json: body })
      .then(res => {
        console.log("Successful response");
        return { statusCode: 200 };
      })
      .catch(err => {
        console.log("Error on subscription");
        console.log(JSON.stringify(err));
        return { statusCode: 500, body: err };
      });
  };

  const unsubscribe = async () => {
    console.log("Inside unsubscribe");

    if (!requestData.subscriptionId) {
      return { statusCode: 400, body: 'invalid request, you are missing the "subscriptionId" key' };
    }

    console.log("No subscribtion id provided.");

    // The EventSub subscription ID, which can be obtained by using the Status test, must be provided for use of this endpoint to be successful.
    return await got.delete(TWITCH_SUBSCRIPTION_API_URL, { ...options, searchParams: { id: requestData.subscriptionId }})
      .then(res => {
        console.log("Delete successful");
        return { statusCode: 200, body: res.body };
      })
      .catch(err => {
        console.log("Error on unsubscribe");
        console.log(JSON.stringify(err));
        return { statusCode: 500, body: err };
      });
  };

  const status = async () => {
    console.log("Inside status");
    return await got(TWITCH_SUBSCRIPTION_API_URL, options)
      .then(res => {
        console.log("status successful");
        return { statusCode: 200, body: res.body };
      })
      .catch(err => {
        console.log("Error on status");
        console.log(JSON.stringify(err));
        return { statusCode: 500, body: err };
      });
  };


  if (requestData.type === 'subscribe') {
    console.log("type is subscribe");
    await subscribe();

    console.log("subscribbed to channel");
    let multipleItems = [];

    if (requestData.discordBotToken) {
      console.log("discordBotToken provided");
      let putItem = {};
      putItem['PutRequest'] = {};

      let item = {};
      item[PRIMARY_KEY] = requestData.broadcasterUserId;
      item[SORT_KEY] = 'discord'
      item['botToken'] = requestData.discordBotToken;

      putItem['PutRequest']['Item'] = item;
      multipleItems.push(putItem);
    }

    if (requestData.twitchChannelName) {
      console.log("twitchChannelName provided");
      let putItem = {};
      putItem['PutRequest'] = {};

      let item = {};
      item[PRIMARY_KEY] = requestData.broadcasterUserId;
      item[SORT_KEY] = 'twitch'
      item['channel'] = requestData.twitchChannelName;

      putItem['PutRequest']['Item'] = item;
      multipleItems.push(putItem);
    }

    if (requestData.rewards && requestData.rewards.length > 0) {   
      for(var rewardIndex in requestData.rewards){
        let putItem = {};
        putItem['PutRequest'] = {};

        let ritem = {};
        ritem[PRIMARY_KEY] = requestData.broadcasterUserId;
        ritem[SORT_KEY] = requestData.rewards[rewardIndex].id + '';
        ritem['cost'] = requestData.rewards[rewardIndex].cost + '';
        ritem['title'] = requestData.rewards[rewardIndex].title + '';
        ritem['prompt'] = requestData.rewards[rewardIndex].prompt + '';
        //ritem['is_user_input_required'] = reward.is_user_input_required;
        ritem['discordRole'] = requestData.rewards[rewardIndex].discordRole + '';

        putItem['PutRequest']['Item'] = ritem;
        multipleItems.push(putItem);
      }
    }

    let putItem = {};
    putItem['PutRequest'] = {};

    let item = {};
    item[PRIMARY_KEY] = requestData.broadcasterUserId;
    item[SORT_KEY] = 'audit';
    item['lastUpdate'] = (Math.floor(+new Date() / 1000)).toString();
    item['lambdaRequestId'] = context.awsRequestId;

    putItem['PutRequest']['Item'] = item;
    multipleItems.push(putItem);
 
    let dynamodbConfig = {};
    dynamodbConfig[TABLE_NAME] = multipleItems;

    const params = {
      RequestItems: dynamodbConfig
    };

    console.log("params: " + JSON.stringify(params));  

    try {
      await db.batchWrite(params).promise();
      console.log("Successfully batch write");
      return { statusCode: 200 };
    } catch (dbError) {
      console.log("Error on batch write");
      console.log(JSON.stringify(dbError));
      const errorResponse = "TBD";
      return { statusCode: 500, body: errorResponse };
    }
  } else if (requestData.type === 'unsubscribe') {
    return unsubscribe();
  } else if (requestData.type === 'status') {
    return status();
  } else {
    return { statusCode: 400, body: 'Unknown type' };
  }
};
