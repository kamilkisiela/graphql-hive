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
  }
}
