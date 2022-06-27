import type { NextWebVitalsMetric } from 'next/app';
import { GA_TRACKING_ID } from '@/constants';

export const pageview = (url: string): void => {
  if (!GA_TRACKING_ID) {
    return;
  }
  (window as any).gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({ action, category, label, value }: any): void => {
  if (!GA_TRACKING_ID) {
    return;
  }
  (window as any).gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

export function reportWebVitals({ id, name, label, value }: NextWebVitalsMetric): void {
  if (!GA_TRACKING_ID) {
    return;
  }
  (window as any).gtag('event', name, {
    event_category: label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
    value: Math.round(name === 'CLS' ? value * 1000 : value),
    event_label: id,
    non_interaction: true,
  });
}
