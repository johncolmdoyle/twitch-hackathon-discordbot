#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { PubSubStack } from '../lib/twitch-hackathon-pub-sub-stack';
import { CertStack } from '../lib/twitch-hackathon-certificate-stack';
import { AuthWebsiteStack } from '../lib/twitch-hackathon-auth-cfn-stack';

const domainName = 'gizmo.codes';
const authCFNSubDomain = 'twitch-hackathon.';
const apiSubDomain = 'twitch-hackathon-api.';

const app = new cdk.App();

const certifcate = new CertStack(app, 'twitch-hackathon-cert', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    domainName: domainName,
    authSubDomainName: authCFNSubDomain,
    apiSubDomainName: apiSubDomain
  });

new PubSubStack(app, 'twitch-hackathon-pub-sub', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    domainName: domainName,
    subDomainName: apiSubDomain,
    certificate: certifcate.apiCert
  });

new AuthWebsiteStack(app, 'twitch-hackathon-auth-cfn', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    domainName: domainName,
    subDomainName: authCFNSubDomain,
    certificate: certifcate.cfnCert
  });

cdk.Tags.of(app).add("app", "twitch-hackathon");
