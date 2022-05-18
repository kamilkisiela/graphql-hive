import * as kx from '@pulumi/kubernetesx';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export function normalizeEnv(env: kx.types.Container['env']): any[] {
  return Array.isArray(env)
    ? env
    : Object.keys(env as kx.types.EnvMap).map((name) => ({
        name,
        value: (env as kx.types.EnvMap)[name],
      }));
}

export class PodBuilder extends kx.PodBuilder {
  public asExtendedDeploymentSpec(
    args?: kx.types.PodBuilderDeploymentSpec,
    metadata?: k8s.types.input.meta.v1.ObjectMeta
  ): pulumi.Output<k8s.types.input.apps.v1.DeploymentSpec> {
    const podName = this.podSpec.containers.apply((containers: any) => {
      return pulumi.output(containers[0].name);
    });
    const appLabels = { app: podName };

    const _args = args || {};
    const deploymentSpec: k8s.types.input.apps.v1.DeploymentSpec = {
      ..._args,
      selector: { matchLabels: appLabels },
      replicas: _args.replicas ?? 1,
      template: {
        metadata: { labels: appLabels, ...(metadata || {}) },
        spec: this.podSpec,
      },
    };
    return pulumi.output(deploymentSpec);
  }
}
