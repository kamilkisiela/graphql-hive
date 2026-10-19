import type { EChartsOption } from 'echarts';
import { createPreview, type NavPath } from 'react-foundry';
import { Card } from '@/components/ui/primitives/card/card';
import { formatNumber } from '@/lib/hooks/use-formatted-number';
import { Chart } from './chart';
import { useChartTheme } from './chart-theme';
import { week } from './preview-data';
import * as styles from './chart.preview.css';

export const nav: NavPath = 'Primitives/Charts/Chart';

const REQUESTS = week(12_000);
const FAILURES = week(150, 3);

function RequestsAndFailures(props: { legend?: boolean }) {
  const theme = useChartTheme();
  const option: EChartsOption = {
    grid: theme.grid(props.legend),
    legend: props.legend ? theme.legend() : { show: false },
    tooltip: theme.tooltip(formatNumber),
    xAxis: theme.timeAxis(REQUESTS[0][0], REQUESTS[REQUESTS.length - 1][0]),
    yAxis: theme.valueAxis(formatNumber),
    series: [
      {
        type: 'line',
        name: 'Requests',
        showSymbol: false,
        color: theme.colors.primary,
        areaStyle: {},
        emphasis: { focus: 'series' },
        data: REQUESTS,
      },
      {
        type: 'line',
        name: 'Failures',
        showSymbol: false,
        color: theme.colors.error,
        areaStyle: {},
        emphasis: { focus: 'series' },
        data: FAILURES,
      },
    ],
  };
  return <Chart option={option} height={200} />;
}

/** The shared look on a raised card, the way Insights mounts it. Hover for the overlay tooltip. */
export const Default = createPreview(() => (
  <div className={styles.div}>
    <Card
      variants={{ onSurface: 'raised', titleSize: 'large' }}
      title="Operations over time"
      description="Timeline of GraphQL requests and failures"
    >
      <RequestsAndFailures />
    </Card>
  </div>
));

/**
 * The legend is ECharts' own, so clicking an entry hides its series and hovering highlights it.
 * It sits under the axis labels in a row the grid reserves, so the two never overlap.
 */
export const Legend = createPreview(() => (
  <div className={styles.div2}>
    <Card
      variants={{ onSurface: 'raised', titleSize: 'large' }}
      title="Operations over time"
      description="Timeline of GraphQL requests and failures"
    >
      <RequestsAndFailures legend />
    </Card>
  </div>
));
