import * as k8s from '@pulumi/kubernetes';

export class CertManager {
  public deployCertManagerAndIssuer() {
    const certManager = new k8s.yaml.ConfigFile('cert-manager', {
      file: 'https://github.com/jetstack/cert-manager/releases/download/v1.10.0/cert-manager.yaml',
    });

    const issuerName = 'letsencrypt-prod';

    new k8s.apiextensions.CustomResource(
      'cert-manager-issuer',
      {
        apiVersion: 'cert-manager.io/v1',
        kind: 'ClusterIssuer',
        metadata: {
          name: issuerName,
        },
        spec: {
          acme: {
            server: 'https://acme-v02.api.letsencrypt.org/directory',
            email: 'contact@the-guild.dev',
            privateKeySecretRef: {
              name: issuerName,
            },
            solvers: [
              {
                http01: {
                  ingress: {
                    class: 'contour',
                  },
                },
              },
            ],
          },
        },
      },
      {
        dependsOn: [certManager],
      },
    );

    return {
      tlsIssueName: issuerName,
    };
  }
}
