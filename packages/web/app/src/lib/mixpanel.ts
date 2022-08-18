import mixpanel from 'mixpanel-browser';

// The reason why we wrap mixpanel with custom functions is that
// mixpanel sends some events even though `mixpanel.disable()` was called

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

const enabled = typeof window !== 'undefined' && window.location.host === 'app.graphql-hive.com' && !!MIXPANEL_TOKEN;

export function initMixpanel() {
  if (enabled) {
    mixpanel.init(MIXPANEL_TOKEN);
  }
}

export function track(eventName: string, data?: Record<string, any>) {
  if (enabled) {
    mixpanel.track(eventName, data);
  }
}

export function identify(id: string, email: string) {
  if (enabled) {
    mixpanel.identify(id);
    mixpanel.people.set({
      email,
    });
  }
}

export function reset() {
  if (enabled) {
    mixpanel.reset();
  }
}
