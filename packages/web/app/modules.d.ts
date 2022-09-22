declare module 'node-crisp-api';
declare module 'tailwindcss/colors';

declare module '@n1ru4l/react-time-ago' {
  export function TimeAgo(props: {
    date: Date;
    children: (args: { value: string }) => React.ReactElement;
  }): React.ReactElement;
}
