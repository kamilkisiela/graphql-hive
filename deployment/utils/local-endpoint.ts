import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export function serviceLocalEndpoint(service: k8s.types.input.core.v1.Service) {
  return pulumi.all([service.metadata, service.spec]).apply(([metadata, spec]) => {
    const defaultPort = (spec?.ports || [])[0];
    const portText = defaultPort ? `:${defaultPort.port}` : '';

    return `http://${metadata?.name}.${metadata?.namespace || 'default'}.svc.cluster.local${portText}`;
  });
}

export function serviceLocalHost(service: k8s.types.input.core.v1.Service) {
  return pulumi.all([service.metadata]).apply(([metadata]) => {
    return `${metadata?.name}.${metadata?.namespace || 'default'}.svc.cluster.local`;
  });
}

export function serviceLocalMetricsEndpoint(service: k8s.types.input.core.v1.Service) {
  return pulumi.all([service.metadata]).apply(([metadata]) => {
    return `${metadata?.name}.${metadata?.namespace || 'default'}.svc.cluster.local:10254/metrics`;
  });
}
