export const LAST_VISITED_ORG_KEY = 'lastVisitedOrganization';

export const GA_TRACKING_ID = globalThis.process?.env['GA_TRACKING_ID'] ?? globalThis['__ENV__']?.['GA_TRACKING_ID'];

export const CRISP_WEBSITE_ID =
  globalThis.process?.env['CRISP_WEBSITE_ID'] ?? globalThis['__ENV__']?.['CRISP_WEBSITE_ID'];
