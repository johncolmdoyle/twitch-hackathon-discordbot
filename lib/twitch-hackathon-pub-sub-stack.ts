import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as acm from '@aws-cdk/aws-certificatemanager';

interface PubSubStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly subDomainName: string;
  readonly certificate: acm.ICertificate;
  readonly env: any;
}

export class PubSubStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: PubSubStackProps) {
    super(scope, id, props);

    const dyanmodbPrimaryKeyName = 'id';

    // DYNAMODB TABLE
    const eventTable = new dynamodb.Table(this, "eventTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: dyanmodbPrimaryKeyName, type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE
    });

    // NODE LAMBDA
    const etlLambda = new lambda.Function(this, 'etlFunction', {
      code: new lambda.AssetCode('etl'),
      handler: 'etl.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: eventTable.tableName,
        PRIMARY_KEY: dyanmodbPrimaryKeyName
      }
    });

    // LAMBDA PERMISSIONS
    eventTable.grantWriteData(etlLambda);

    // API GATEWAY
    const api = new apigateway.RestApi(this, 'twitchEventSub', {
      restApiName: 'API Twitch Hackathon',
    });

    const events = api.root.addResource('events');

    const etlIntegration = new apigateway.LambdaIntegration(etlLambda);
    const createEventMethod = events.addMethod('POST', etlIntegration, {});
    addCorsOptions(events);
  }
}

export function addCorsOptions(apiResource: apigateway.IResource) {
  apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}
