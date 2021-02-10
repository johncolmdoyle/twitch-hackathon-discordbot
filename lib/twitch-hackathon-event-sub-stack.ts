import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';

interface EventSubStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly subDomainName: string;
  readonly certificate: acm.ICertificate;
  readonly env: any;
  readonly twitchClientId: string;
  readonly twitchClientSecret: string;
  readonly twitchEventSubSecret: string;
  readonly eventTable: dynamodb.ITable;
  readonly eventTablePK: string;
  readonly subscriberTable: dynamodb.ITable;
  readonly subscriberTablePK: string;
}

export class EventSubStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: EventSubStackProps) {
    super(scope, id, props);

    // API GATEWAY
    const api = new apigateway.RestApi(this, 'twitchEventSub', {
      restApiName: 'API Twitch Hackathon',
    });

    const restApiCustomDomain = new apigateway.DomainName(this, 'restApiCustomDomain', {
      domainName: props.subDomainName.concat(props.domainName),
      certificate: props.certificate
    });

    restApiCustomDomain.addBasePathMapping(api);

    // NODE LAMBDA
    const etlLambda = new lambda.Function(this, 'etlFunction', {
      code: new lambda.AssetCode('etl'),
      handler: 'src/etl.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: props.eventTable.tableName,
        PRIMARY_KEY: props.eventTablePK,
        TWITCH_EVENT_SUB_SECRET: props.twitchEventSubSecret
      }
    });

    const subscriptionLambda = new lambda.Function(this, 'subscriptionFunction', {
      code: new lambda.AssetCode('etl'),
      handler: 'src/subscription.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: props.subscriberTable.tableName,
        PRIMARY_KEY: props.subscriberTablePK,
        TWITCH_CLIENT_ID: props.twitchClientId,
        TWITCH_CLIENT_SECRET: props.twitchClientSecret,
        TWITCH_EVENT_SUB_SECRET: props.twitchEventSubSecret,
        TWITCH_CALLBACK: 'https://' + props.subDomainName.concat(props.domainName) + '/events'
      }
    });

    // LAMBDA PERMISSIONS
    props.eventTable.grantWriteData(etlLambda);
    props.subscriberTable.grantWriteData(subscriptionLambda);

    // API Methods
    const events = api.root.addResource('events');
    const subscriptions = api.root.addResource('subscriptions');

    const etlIntegration = new apigateway.LambdaIntegration(etlLambda);
    const createEventMethod = events.addMethod('POST', etlIntegration, {});
    addCorsOptions(events);

    const subscriptionIntegration = new apigateway.LambdaIntegration(subscriptionLambda);
    const createSubMethod = subscriptions.addMethod('POST', subscriptionIntegration, {});
    addCorsOptions(subscriptions);

    // ROUTE 53
    const zone = route53.HostedZone.fromLookup(this, "zone", { domainName: props.domainName });

    new route53.ARecord(this, 'apiCustomDomainAliasRecord', {
      zone: zone,
      recordName: props.subDomainName.slice(0, -1), // ignore the '.'
      target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(restApiCustomDomain))
    });
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
