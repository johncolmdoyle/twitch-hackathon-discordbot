import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';

interface APIStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly subDomainName: string;
  readonly certificate: acm.ICertificate;
  readonly env: any;
}

export class APIStack extends cdk.Stack {
  public api: apigateway.IRestApi;

  constructor(scope: cdk.App, id: string, props: APIStackProps) {
    super(scope, id, props);

    // API GATEWAY
    this.api = new apigateway.RestApi(this, 'twitchEventSub', {
      restApiName: 'API Twitch Hackathon',
    });

    const restApiCustomDomain = new apigateway.DomainName(this, 'restApiCustomDomain', {
      domainName: props.subDomainName.concat(props.domainName),
      certificate: props.certificate
    });

    restApiCustomDomain.addBasePathMapping(this.api);

    // ROUTE 53
    const zone = route53.HostedZone.fromLookup(this, "zone", { domainName: props.domainName });

    new route53.ARecord(this, 'apiCustomDomainAliasRecord', {
      zone: zone,
      recordName: props.subDomainName.slice(0, -1), // ignore the '.'
      target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(restApiCustomDomain))
    });
  }
}