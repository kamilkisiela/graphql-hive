import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

export type ChartEvents = Record<string, (params: any) => void>;

type ChartProps = {
  option: EChartsOption;
  height: number;
  onEvents?: ChartEvents;
};

/**
 * One ECharts instance, sized by its container's width and the given height.
 *
 * Owns the instance directly rather than through echarts-for-react, which creates a throwaway
 * instance and waits for it to render before making the real one: a re-render in that gap drew
 * the chart on the throwaway, so every chart animated in twice.
 */
export function Chart({ option, height, onEvents }: ChartProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<echarts.ECharts | null>(null);

  // A 0x0 mount (a chart under display: none) makes ECharts warn and lay out at zero, so the
  // instance waits for the container's first real size.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    let instance: echarts.ECharts | null = null;
    const init = () => {
      instance = echarts.init(element);
      setChart(instance);
    };
    if (element.clientWidth && element.clientHeight) {
      init();
    }
    const observer = new ResizeObserver(([entry]) => {
      if (instance) {
        instance.resize();
      } else if (entry.contentRect.width && entry.contentRect.height) {
        init();
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      instance?.dispose();
      setChart(null);
    };
  }, []);

  // Merged, not replaced, so a re-render with the same data does not replay the entry animation.
  useLayoutEffect(() => {
    chart?.setOption(option);
  }, [chart, option]);

  useEffect(() => {
    if (!chart || !onEvents) {
      return;
    }
    const entries = Object.entries(onEvents);
    for (const [name, handler] of entries) {
      chart.on(name, handler);
    }
    return () => {
      for (const [name, handler] of entries) {
        chart.off(name, handler);
      }
    };
  }, [chart, onEvents]);

  // ECharts writes a fixed pixel width onto its mount. Out of normal flow, that width cannot become
  // the min-content width of the flex column a chart sits in, which would stop the page shrinking.
  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={elementRef} className="absolute inset-0" />
    </div>
  );
}
