import { env } from '@/env/frontend';

export const pageview = (url: string): void => {
  if (!env.analytics.googleAnalyticsTrackingId) {
    return;
  }

  (window as any).gtag('config', env.analytics.googleAnalyticsTrackingId, {
    page_path: url,
  });
};
