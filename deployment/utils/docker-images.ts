import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export function createDockerImageFactory(options: {
  registryHostname: string;
  imagesPrefix: string;
}) {
  return {
    getImageId(imageName: string, tag?: string) {
      return `${options.registryHostname}/${options.imagesPrefix}/${imageName}${
        tag ? `:${tag}` : ''
      }`;
    },
    createRepositorySecret(base64Auth: pulumi.Output<string>) {
      const base64JsonEncodedCredentials = base64Auth.apply(value => {
        const authJson = {
          auths: {
            [options.registryHostname]: {
              auth: value,
            },
          },
        };

        return Buffer.from(JSON.stringify(authJson)).toString('base64');
      });

      return new k8s.core.v1.Secret('image-pull-secret', {
        metadata: {
          name: 'image-pull-secret',
        },
        type: 'kubernetes.io/dockerconfigjson',
        data: {
          '.dockerconfigjson': base64JsonEncodedCredentials,
        },
      });
    },
  };
}

export type DockerImageFactory = ReturnType<typeof createDockerImageFactory>;
