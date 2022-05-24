import { InjectionToken } from 'graphql-modules';

export const FEEDBACK_SLACK_TOKEN = new InjectionToken<string>('FEEDBACK_SLACK_TOKEN');
export const FEEDBACK_SLACK_CHANNEL = new InjectionToken<string>('FEEDBACK_SLACK_CHANNEL');
