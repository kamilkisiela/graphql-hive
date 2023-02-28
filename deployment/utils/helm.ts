import { ChartOpts } from '@pulumi/kubernetes/helm/v3';

export function helmChart(
  repo: string,
  chart: string,
  version: string,
): Pick<ChartOpts, 'chart' | 'version' | 'fetchOpts'> {
  return {
    chart,
    version,
    fetchOpts: {
      repo,
    },
  };
}
