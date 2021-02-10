require('dotenv').config()

const got = require('got');

const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();
const {"v4": uuidv4} = require('uuid');

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';

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

  const requestData = typeof event.body == 'object' ? event.body : JSON.parse(event.body);
  console.log(JSON.stringify(requestData));

  if (!requestData.type) {
    return { statusCode: 400, body: 'invalid request, you are missing the "type" key' };
  }

  if (!requestData.broadcasterUserId) {
    return { statusCode: 400, body: 'invalid request, you are missing the "broadcasterUserId" key' };
  }

  const token = await getAppToken();

  if (!token) {
    return { statusCode: 500, body: 'Error obtaining App token' };
  }

  const options = {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    responseType: 'json'
  };

  const subscribe = async () => {
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
        return { statusCode: 200 };
      })
      .catch(err => {
        console.log(err);
        return { statusCode: 500, body: err };
      });
  };

  const unsubscribe = async () => {
    if (!requestData.subscriptionId) {
      return { statusCode: 400, body: 'invalid request, you are missing the "subscriptionId" key' };
    }

    // The EventSub subscription ID, which can be obtained by using the Status test, must be provided for use of this endpoint to be successful.
    return await got.delete(TWITCH_SUBSCRIPTION_API_URL, { ...options, searchParams: { id: requestData.subscriptionId }})
      .then(res => {
        console.log(res.body);
        return { statusCode: 200, body: res.body };
      })
      .catch(err => {
        console.log(err);
        return { statusCode: 500, body: err };
      });
  };

  const status = async () => {
    return await got(TWITCH_SUBSCRIPTION_API_URL, options)
      .then(res => {
        console.log(JSON.stringify(res.body));
        return { statusCode: 200, body: res.body };
      })
      .catch(err => {
        return { statusCode: 500, body: err };
      });
  };


  if (requestData.type === 'subscribe') {
    await subscribe();
    let item = {};

    item[PRIMARY_KEY] = uuidv4();
    item['createdAt'] = (Math.floor(+new Date() / 1000)).toString();
    item['lambdaRequestId'] = context.awsRequestId;
    item['requestData'] = requestData;

    const params = {
      TableName: TABLE_NAME,
      Item: item
    };

    try {
      await db.put(params).promise();
      return { statusCode: 200 };
    } catch (dbError) {
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
