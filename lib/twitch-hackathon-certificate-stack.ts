import * as cdk from '@aws-cdk/core';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';

interface CertStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly authSubDomainName: string;
  readonly apiSubDomainName: string;
  readonly env: any;
}

export class CertStack extends cdk.Stack {
  public readonly cfnCert: acm.ICertificate;
  public readonly apiCert: acm.ICertificate;

  constructor(scope: cdk.Construct, id: string, props: CertStackProps) {
    super(scope, id, props);
      // CERTIFICATE
      const zone = route53.HostedZone.fromLookup(this, "zone", { domainName: props.domainName });

      const authCert = new acm.Certificate(this, 'acmAuthCert', {
         domainName: props.authSubDomainName.concat(props.domainName),
         validation: acm.CertificateValidation.fromDns(zone),
      });

      const apiGWCert = new acm.Certificate(this, 'acmApiCert', {
         domainName: props.apiSubDomainName.concat(props.domainName),
         validation: acm.CertificateValidation.fromDns(zone),
      });

      this.cfnCert = authCert;
      this.apiCert = apiGWCert;
  }
}
