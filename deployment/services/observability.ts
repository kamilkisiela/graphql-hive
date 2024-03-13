import * as pulumi from '@pulumi/pulumi';
import { serviceLocalHost } from '../utils/local-endpoint';
import { Observability as ObservabilityInstance } from '../utils/observability';
import { deployGrafana } from './grafana';

export function deployObservability(config: { envName: string }) {
  const observabilityConfig = new pulumi.Config('observability');

  if (!observabilityConfig.getBoolean('enabled')) {
    return {
      enabled: false,
    };
  }

  const observability = new ObservabilityInstance(config.envName, {
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
    tempo: {
      endpoint: observabilityConfig.require('tempoEndpoint'),
      username: observabilityConfig.require('tempoUsername'),
      password: observabilityConfig.requireSecret('tempoPassword'),
    },
  });

  const observabilityInstance = observability.deploy();

  return {
    tracingEndpoint: serviceLocalHost(observabilityInstance.otlpCollectorService).apply(
      host => `http://${host}:4318/v1/traces`,
    ),
    observability: observabilityInstance,
    grafana: deployGrafana(config.envName),
    enabled: true,
  };
}

export type Observability = ReturnType<typeof deployObservability>;
