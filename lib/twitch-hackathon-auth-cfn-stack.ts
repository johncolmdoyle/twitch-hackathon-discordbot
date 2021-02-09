import * as cdk from '@aws-cdk/core';
import { CloudFrontWebDistribution } from '@aws-cdk/aws-cloudfront'
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import * as route53 from '@aws-cdk/aws-route53';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as targets from '@aws-cdk/aws-route53-targets';

interface AuthWebsiteStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly subDomainName: string;
  readonly certificate: acm.ICertificate;
  readonly env: any;
}

export class AuthWebsiteStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: AuthWebsiteStackProps) {
    super(scope, id, props);

    const websiteDistSourcePath = './auth-website';

    const sourceBucket = new Bucket(this, 'websiteSource', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true
    });

    new BucketDeployment(this, 'websiteDeploy', {
      sources: [Source.asset(websiteDistSourcePath)],
      destinationBucket: sourceBucket
    });

    const distribution = new CloudFrontWebDistribution(this, 'websiteCfn', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket
          },
          behaviors : [ {isDefaultBehavior: true}]
        }
      ],
      aliasConfiguration: {
        acmCertRef: props?.certificate?.certificateArn || '',
        names: [props.subDomainName.concat(props.domainName)]
      }
    });

    const zone = route53.HostedZone.fromLookup(this, "zone", { domainName: props.domainName });

    const websiteARecord = new route53.ARecord(this, 'websiteARecord', {
      zone: zone,
      recordName: props.subDomainName.concat(props.domainName),
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution))
    });
  }
}
