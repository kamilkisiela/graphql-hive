import * as k8s from '@pulumi/kubernetes';
import { Output } from '@pulumi/pulumi';

export class ServiceSecret<T extends Record<string, string | Output<string>>> {
  public record: k8s.core.v1.Secret;
  public raw: T;

  constructor(
    protected name: string,
    protected data: T,
  ) {
    this.raw = data;
    this.record = new k8s.core.v1.Secret(this.name, {
      metadata: {
        name: this.name,
      },
      data: this.data,
    });
  }
}
