declare module 'node-crisp-api';
declare module 'tailwindcss/colors';

declare module '@n1ru4l/react-time-ago' {
  export function TimeAgo(props: {
    date: Date;
    children: (args: { value: string }) => React.ReactElement;
  }): React.ReactElement;
}

declare namespace NodeJS {
  export interface ProcessEnv {
    APP_BASE_URL: string;
    GITHUB_APP_NAME: string;
    GRAPHQL_ENDPOINT: string;
    SUPERTOKENS_CONNECTION_URI: string;
  }
}

// eslint-disable-next-line no-var
declare var __ENV__:
  | undefined
  | {
      APP_BASE_URL: string;
      STRIPE_PUBLIC_KEY: string | undefined;
      AUTH_GITHUB: string | undefined;
      AUTH_GOOGLE: string | undefined;
      MIXPANEL_TOKEN: string | undefined;
      GA_TRACKING_ID: string | undefined;
      CRISP_WEBSITE_ID: string | undefined;
    };
