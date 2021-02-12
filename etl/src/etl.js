const AWS = require('aws-sdk');
const crypto = require('crypto');
const db = new AWS.DynamoDB.DocumentClient();
const {"v4": uuidv4} = require('uuid');
const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';
const TWITCH_EVENT_SUB_SECRET = process.env.TWITCH_EVENT_SUB_SECRET || '';

const twitchEventSubMessageId = 'Twitch-Eventsub-Message-Id';
const twitchEventSubMessageTimestamp = 'Twitch-Eventsub-Message-Timestamp';

exports.handler = async (event, context, callback) => {
  console.log(JSON.stringify(event));

  if (!event.body) {
    return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
  }

  const verifySignature = () => {
    // Generate a signature from the id, timestamp, and request body
    const message = event.headers[twitchEventSubMessageId] + event.headers[twitchEventSubMessageTimestamp] + event.body;
    const signature = 'sha256=' + crypto.createHmac('sha256', TWITCH_EVENT_SUB_SECRET).update(message).digest('hex');

    // Compare generated signature against Twitch's provided signature
    return signature === event.headers['Twitch-Eventsub-Message-Signature'];
  };

  if (!verifySignature()) {
    console.log("Verification Failed");
    return { statusCode: 403, body: 'Verification failed' };
  }

  const userData = typeof event.body == 'object' ? event.body : JSON.parse(event.body);

  console.log(JSON.stringify(userData));

  const type = event.headers['Twitch-Eventsub-Message-Type'];

  if (type === 'webhook_callback_verification') {
    console.log("callback");
    return { statusCode: 200, body: userData.challenge };
  } else if (type === 'notification') {
    console.log("notification");
    let item = {};

    item[PRIMARY_KEY] = uuidv4();
    item['createdAt'] = (Math.floor(+new Date() / 1000)).toString();
    item['lambdaRequestId'] = context.awsRequestId;
    item['twitchEventSubMessageId'] = event.headers[twitchEventSubMessageId];
    item['twitchEventSubMessageTimestamp'] = event.headers[twitchEventSubMessageTimestamp];
    item['twitchEventSubMessage'] = userData;
    if (userData.event) {
      item['broadcaster_user_id'] = userData.event.broadcaster_user_id;
      item['user_id'] = userData.event.user_id;
      item['user_name'] = userData.event.user_name;
    }

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
  } else if (type === 'revocation') {
    console.log("revocation");
    return { statusCode: 200 };
  } else {
    console.log("Unknown type: " + type);
    return { statusCode: 400, body: 'Unknown message type' };
  }
};
