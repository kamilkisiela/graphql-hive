import { alerting, oss } from '@pulumiverse/grafana';

/**
 * Provisions Grafana alert rules that target the Prometheus metrics exposed by
 * the metric-alert evaluator. Pairs with the Metric-Alerts dashboard at
 * `deployment/grafana-dashboards/Metric-Alerts.json`.
 *
 * Why these specific rules: the metric-alert evaluator runs every minute and
 * issues one ClickHouse query per `(target, timeWindow, savedFilter)` group.
 * Two failure modes will produce stale or missing user alerts before any user
 * notices, so we want to catch them automatically:
 *   1. ClickHouse latency degrades — queries take long enough that the cron
 *      misses ticks or hits its task timeout.
 *   2. ClickHouse query error rate climbs — partial outage means rules silently
 *      fail to evaluate.
 */
export function deployGrafanaAlerts(envName: string) {
  // Separate folder from dashboards keeps the alerts list scoped and makes it
  // clear what's machine-managed vs. operator-edited.
  const folder = new oss.Folder('grafana-hive-alerts-folder', {
    title: `Hive Alerts (${envName})`,
    uid: 'hive-alerts',
  });

  // Single rule group for the metric-alerts feature; evaluation interval
  // matches the cron that produces the underlying metrics (every minute).
  const ruleGroup = new alerting.RuleGroup('metric-alerts-evaluator', {
    folderUid: folder.uid,
    name: 'metric-alerts-evaluator',
    intervalSeconds: 60,
    rules: [
      {
        name: 'MetricAlertEvaluatorClickHouseSlow',
        for: '5m',
        condition: 'C',
        noDataState: 'OK',
        execErrState: 'Alerting',
        annotations: {
          summary: 'Metric-alert evaluator ClickHouse queries are slow',
          description:
            'p99 ClickHouse query duration in the metric alert evaluator has been > 5s for 5 minutes. The cron may miss ticks or alert state may be stale.',
          runbook_url:
            'https://github.com/graphql-hive/console/blob/main/packages/services/workflows/src/lib/metric-alert-evaluator.ts',
        },
        labels: { severity: 'warning', component: 'metric-alerts' },
        isPaused: false,
        datas: [
          {
            refId: 'A',
            queryType: '',
            relativeTimeRange: { from: 600, to: 0 },
            datasourceUid: 'grafanacloud-prom',
            model: JSON.stringify({
              refId: 'A',
              expr: 'histogram_quantile(0.99, sum by (le) (rate(hive_metric_alert_clickhouse_query_duration_seconds_bucket[5m])))',
              instant: false,
              range: true,
              intervalMs: 30_000,
              maxDataPoints: 43_200,
            }),
          },
          {
            // Reduce the range-query time series (A) to a single value (its
            // last point) so the threshold below receives "reduced" data.
            // Without this, the `threshold` expression rejects the series with
            // "looks like time series data, only reduced data can be alerted
            // on", and because execErrState is Alerting the rule then fires on
            // the eval error itself rather than on real slowness.
            refId: 'B',
            queryType: '',
            relativeTimeRange: { from: 0, to: 0 },
            datasourceUid: '__expr__',
            model: JSON.stringify({
              refId: 'B',
              type: 'reduce',
              reducer: 'last',
              expression: 'A',
              datasource: { type: '__expr__', uid: '__expr__' },
            }),
          },
          {
            refId: 'C',
            queryType: '',
            relativeTimeRange: { from: 0, to: 0 },
            datasourceUid: '__expr__',
            model: JSON.stringify({
              refId: 'C',
              type: 'threshold',
              expression: 'B',
              conditions: [
                {
                  type: 'query',
                  evaluator: { type: 'gt', params: [5] },
                  operator: { type: 'and' },
                  query: { params: ['B'] },
                  reducer: { type: 'last', params: [] },
                },
              ],
              datasource: { type: '__expr__', uid: '__expr__' },
            }),
          },
        ],
      },
      {
        name: 'MetricAlertEvaluatorClickHouseErrors',
        for: '5m',
        condition: 'C',
        noDataState: 'OK',
        execErrState: 'Alerting',
        annotations: {
          summary: 'Metric-alert evaluator ClickHouse error rate is high',
          description:
            'More than 5% of ClickHouse queries from the metric alert evaluator have errored over the last 5 minutes. Some rules are not evaluating; user alert state is stale.',
          runbook_url:
            'https://github.com/graphql-hive/console/blob/main/packages/services/workflows/src/lib/metric-alert-evaluator.ts',
        },
        labels: { severity: 'critical', component: 'metric-alerts' },
        isPaused: false,
        datas: [
          {
            refId: 'A',
            queryType: '',
            relativeTimeRange: { from: 600, to: 0 },
            datasourceUid: 'grafanacloud-prom',
            model: JSON.stringify({
              refId: 'A',
              // Error ratio: errored queries / total queries. clamp_min on the
              // denominator avoids divide-by-zero when there's no traffic at all.
              expr: 'sum(rate(hive_metric_alert_clickhouse_query_duration_seconds_count{outcome="error"}[5m])) / clamp_min(sum(rate(hive_metric_alert_clickhouse_query_duration_seconds_count[5m])), 0.001)',
              instant: false,
              range: true,
              intervalMs: 30_000,
              maxDataPoints: 43_200,
            }),
          },
          {
            // Reduce the range-query time series (A) to a single value (its
            // last point) so the threshold below receives "reduced" data.
            // Without this, the `threshold` expression rejects the series with
            // "looks like time series data, only reduced data can be alerted
            // on", and because execErrState is Alerting the rule then fires on
            // the eval error itself rather than on a real error-rate spike.
            refId: 'B',
            queryType: '',
            relativeTimeRange: { from: 0, to: 0 },
            datasourceUid: '__expr__',
            model: JSON.stringify({
              refId: 'B',
              type: 'reduce',
              reducer: 'last',
              expression: 'A',
              datasource: { type: '__expr__', uid: '__expr__' },
            }),
          },
          {
            refId: 'C',
            queryType: '',
            relativeTimeRange: { from: 0, to: 0 },
            datasourceUid: '__expr__',
            model: JSON.stringify({
              refId: 'C',
              type: 'threshold',
              expression: 'B',
              conditions: [
                {
                  type: 'query',
                  evaluator: { type: 'gt', params: [0.05] },
                  operator: { type: 'and' },
                  query: { params: ['B'] },
                  reducer: { type: 'last', params: [] },
                },
              ],
              datasource: { type: '__expr__', uid: '__expr__' },
            }),
          },
        ],
      },
    ],
  });

  // Egress policies (see `services/egress-policy.ts`), based on the egress flow logs that the
  // hubble-egress-exporter ships to Loki (the ACNS Hubble metrics have no workload context).
  // Pairs with the Egress-Policies dashboard. Without Cilium + ACNS there's no data, so the
  // rule stays OK.
  const egressRuleGroup = new alerting.RuleGroup('egress-policies', {
    folderUid: folder.uid,
    name: 'egress-policies',
    intervalSeconds: 60,
    rules: [
      {
        name: 'EgressPolicyDrops',
        // A single denied connection keeps the 5m count above 0 for 5 minutes, so this still fires.
        for: '1m',
        condition: 'C',
        noDataState: 'OK',
        execErrState: 'Alerting',
        annotations: {
          summary: 'Egress policy is denying connections for {{ $labels.workload }}',
          description:
            'The egress policy of {{ $labels.workload }} denied new connections to the internet in the last 5 minutes. Either a declaration is missing (allowExternal), or the workload tried to reach a blocked destination (e.g. an internal address from a user-provided URL). See the Egress-Policies dashboard for the hosts and ports.',
          runbook_url:
            'https://github.com/graphql-hive/console/blob/main/deployment/services/egress-policy.ts',
        },
        labels: { severity: 'warning', component: 'egress-policies' },
        isPaused: false,
        datas: [
          {
            refId: 'A',
            queryType: '',
            relativeTimeRange: { from: 600, to: 0 },
            datasourceUid: 'grafanacloud-logs',
            model: JSON.stringify({
              refId: 'A',
              expr: 'sum by (workload) (count_over_time({namespace="kube-system", container_name="hubble-egress-exporter"} | json verdict="flow.verdict" | verdict="DROPPED" | regexp `"k8s:app=(?P<workload>[^"]+)"` [5m]))',
              queryType: 'range',
              intervalMs: 30_000,
              maxDataPoints: 43_200,
            }),
          },
          {
            // Reduce each series to its last point, so the threshold receives "reduced" data.
            refId: 'B',
            queryType: '',
            relativeTimeRange: { from: 0, to: 0 },
            datasourceUid: '__expr__',
            model: JSON.stringify({
              refId: 'B',
              type: 'reduce',
              reducer: 'last',
              expression: 'A',
              datasource: { type: '__expr__', uid: '__expr__' },
            }),
          },
          {
            refId: 'C',
            queryType: '',
            relativeTimeRange: { from: 0, to: 0 },
            datasourceUid: '__expr__',
            model: JSON.stringify({
              refId: 'C',
              type: 'threshold',
              expression: 'B',
              conditions: [
                {
                  type: 'query',
                  evaluator: { type: 'gt', params: [0] },
                  operator: { type: 'and' },
                  query: { params: ['B'] },
                  reducer: { type: 'last', params: [] },
                },
              ],
              datasource: { type: '__expr__', uid: '__expr__' },
            }),
          },
        ],
      },
    ],
  });

  return { folder, ruleGroup, egressRuleGroup };
}
