import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

interface DynamoDBStackProps extends cdk.StackProps {
  readonly env: any;
}

export class DynamoDBStack extends cdk.Stack {
  public readonly eventTable: dynamodb.ITable;
  public readonly eventTablePK: string;

  public readonly subscriberTable: dynamodb.ITable;
  public readonly subscriberTablePK: string;

  constructor(scope: cdk.Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id, props);

    this.eventTablePK = 'id';
    this.subscriberTablePK = 'id';

    // DYNAMODB TABLE
    const eventNotificationsTable = new dynamodb.Table(this, "eventTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: this.eventTablePK, type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE
    });

    const subscriberDetailsTable = new dynamodb.Table(this, "subscriberTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: this.subscriberTablePK, type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE
    });

    // exports
    this.eventTable = eventNotificationsTable;
    this.subscriberTable = subscriberDetailsTable;
  }
}
