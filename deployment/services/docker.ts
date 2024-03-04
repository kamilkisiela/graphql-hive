import * as pulumi from '@pulumi/pulumi';
import { createDockerImageFactory } from '../utils/docker-images';

export function configureDocker() {
  const dockerConfig = new pulumi.Config('docker');
  const dockerImages = createDockerImageFactory({
    registryHostname: dockerConfig.require('registryUrl'),
    imagesPrefix: dockerConfig.require('imagesPrefix'),
  });

  const imagePullSecret = dockerImages.createRepositorySecret(
    dockerConfig.requireSecret('registryAuthBase64'),
  );

  return {
    secret: imagePullSecret,
    factory: dockerImages,
  };
}

export type Docker = ReturnType<typeof configureDocker>;
