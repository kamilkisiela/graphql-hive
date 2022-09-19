import mixpanel from 'mixpanel-browser';

// The reason why we wrap mixpanel with custom functions is that
// mixpanel sends some events even though `mixpanel.disable()` was called

const mixpanelToken = globalThis.process?.env['MIXPANEL_TOKEN'] ?? globalThis['__ENV__']?.['MIXPANEL_TOKEN'];

const enabled = !!mixpanelToken;

export function initMixpanel() {
  if (enabled) {
    mixpanel.init(mixpanelToken);
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
