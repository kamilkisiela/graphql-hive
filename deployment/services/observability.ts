import * as pulumi from '@pulumi/pulumi';
import { Observability } from '../utils/observability';
import { deployGrafana } from './grafana';

const observabilityConfig = new pulumi.Config('observability');

export function deployMetrics(config: { envName: string }) {
  if (!observabilityConfig.getBoolean('enabled')) {
    return;
  }

  const observability = new Observability(config.envName, {
    prom: {
      endpoint: observabilityConfig.require('promEndpoint'),
      username: observabilityConfig.require('promUsername'),
      password: observabilityConfig.requireSecret('promPassword'),
    },
    loki: {
      endpoint: observabilityConfig.require('lokiEndpoint'),
      username: observabilityConfig.require('lokiUsername'),
      password: observabilityConfig.requireSecret('lokiPassword'),
    },
  });

  return {
    observability: observability.deploy(),
    grafana: deployGrafana(config.envName),
  };
}
