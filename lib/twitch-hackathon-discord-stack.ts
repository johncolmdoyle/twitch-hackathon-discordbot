import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sqs from '@aws-cdk/aws-sqs';
import { DynamoEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';
import * as apigateway from '@aws-cdk/aws-apigateway';

interface DiscordStackProps extends cdk.StackProps {
  readonly env: any;
  readonly eventTable: dynamodb.ITable;
  readonly subscriberTable: dynamodb.ITable;
  readonly subscriberTablePK: string;
  readonly subscriberTableSK: string;
  api: apigateway.IRestApi;
}

export class DiscordStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: DiscordStackProps) {
    super(scope, id, props);

    // NODE LAMBDA
    const discordLambda = new lambda.Function(this, 'discordLambda', {
      code: new lambda.AssetCode('discord-bot'),
      handler: 'src/bot.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: props.subscriberTable.tableName,
        PRIMARY_KEY: props.subscriberTablePK,
        SORT_KEY: props.subscriberTableSK
      }
    });

    const discordGetAccessLambda = new lambda.Function(this, 'discordGetAccessLambda', {
      code: new lambda.AssetCode('discord-bot'),
      handler: 'src/api-get-access.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: props.subscriberTable.tableName,
        PRIMARY_KEY: props.subscriberTablePK,
        SORT_KEY: props.subscriberTableSK
      }
    });

    const discordCreateRoleLambda = new lambda.Function(this, 'discordCreateRoleLambda', {
      code: new lambda.AssetCode('discord-bot'),
      handler: 'src/api-create-role.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: props.subscriberTable.tableName,
        PRIMARY_KEY: props.subscriberTablePK,
        SORT_KEY: props.subscriberTableSK
      }
    });

    // LAMBDA PERMISSIONS
    props.eventTable.grantStreamRead(discordLambda);
    props.subscriberTable.grantReadWriteData(discordLambda);
    props.subscriberTable.grantReadWriteData(discordGetAccessLambda);
    props.subscriberTable.grantReadWriteData(discordCreateRoleLambda);

    // DL Queue
    const discordDeadLetterQueue = new sqs.Queue(this, 'discordDeadLetterQueue');

    // DYNAMODB TRIGGER
    discordLambda.addEventSource(new DynamoEventSource(props.eventTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 1,
      bisectBatchOnError: true,
      onFailure: new SqsDlq(discordDeadLetterQueue),
      retryAttempts: 10
    }));

    // API Methods
    let discordEndpoint = props.api.root.addResource('discord');
    let accessEndpoint = discordEndpoint.addResource('access');
    let rolesEndpoint = discordEndpoint.addResource('roles');

    const accessIntegration = new apigateway.LambdaIntegration(discordGetAccessLambda);
    accessEndpoint.addMethod('POST', accessIntegration, {});
    addCorsOptions(accessEndpoint);

    const createRoleIntegration = new apigateway.LambdaIntegration(discordCreateRoleLambda);
    rolesEndpoint.addMethod('POST', createRoleIntegration, {});
    addCorsOptions(rolesEndpoint);
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