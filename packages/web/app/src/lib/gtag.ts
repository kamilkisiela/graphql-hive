import { env } from '@/env/frontend';

export const pageview = (url: string): void => {
  if (!env.analytics.googleAnalyticsTrackingId) {
    return;
  }
  const gtag = (window as any).gtag;

  if (typeof gtag === 'function') {
    gtag('config', env.analytics.googleAnalyticsTrackingId, {
      page_path: url,
    });
  } else {
    console.error('window.gtag function not found');
  }
};
