import type { NextWebVitalsMetric } from 'next/app';
import { env } from '@/env/frontend';

export const pageview = (url: string): void => {
  if (!env.analytics.googleAnalyticsTrackingId) {
    return;
  }
  (window as any).gtag('config', env.analytics.googleAnalyticsTrackingId, {
    page_path: url,
  });
};

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({ action, category, label, value }: any): void => {
  if (!env.analytics.googleAnalyticsTrackingId) {
    return;
  }
  (window as any).gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

export function reportWebVitals({ id, name, label, value }: NextWebVitalsMetric): void {
  if (!env.analytics.googleAnalyticsTrackingId) {
    return;
  }
  (window as any).gtag('event', name, {
    event_category: label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
    value: Math.round(name === 'CLS' ? value * 1000 : value),
    event_label: id,
    non_interaction: true,
  });
}
