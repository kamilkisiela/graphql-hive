import Mixpanel from 'mixpanel';

export const enabled = !!process.env.MIXPANEL_TOKEN;
let mixpanel: Mixpanel.Mixpanel;

if (enabled) {
  mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN ?? '');
}

export function track(event: { event: string; distinct_id: string | null; data?: Record<string, any> }) {
  if (enabled) {
    mixpanel.track(event.event, {
      distinct_id: event.distinct_id,
      ...(event.data ?? {}),
    });
  }
}

export function createOrUpdateUser(user: { id: string; email: string; name?: string }) {
  if (enabled) {
    mixpanel.people.set(user.id, {
      ...('name' in user
        ? {
            $name: user.name,
          }
        : {}), // we don't want to set $name as null or undefined
      $email: user.email,
    });
  }
}
