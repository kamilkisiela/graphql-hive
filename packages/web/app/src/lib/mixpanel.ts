import mixpanel from 'mixpanel-browser';
import type { UserProfile } from '@auth0/nextjs-auth0';

// The reason why we wrap mixpanel with custom functions is that
// mixpanel sends some events even though `mixpanel.disable()` was called

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

const enabled =
  typeof window !== 'undefined' &&
  window.location.host === 'app.graphql-hive.com' &&
  !!MIXPANEL_TOKEN;

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

export function identify(user: UserProfile) {
  if (enabled) {
    mixpanel.identify(user.sub);
    mixpanel.people.set({
      ...('name' in user
        ? {
            $name: user.name,
          }
        : {}),
      $email: user.email,
    });
  }
}

export function reset() {
  if (enabled) {
    mixpanel.reset();
  }
}
