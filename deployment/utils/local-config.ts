import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';

let loadedConfig: any = null;

export function getLocalComposeConfig() {
  loadedConfig ||= yaml.load(readFileSync('../docker/docker-compose.community.yml', 'utf8'));

  return {
    config: loadedConfig,
    service(name: string) {
      const service = loadedConfig.services[name];

      if (!service) {
        throw new Error(`Service ${name} not found in Docker compose file!`);
      }

      return service;
    },
  };
}
