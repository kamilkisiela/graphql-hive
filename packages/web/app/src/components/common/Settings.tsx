import 'twin.macro';
import { Page } from '@/components/common';

export const Settings: React.FC<{
  title: string;
  subtitle: string;
}> = ({ children, title, subtitle }) => {
  return (
    <Page title={title} subtitle={subtitle}>
      <div tw="flex flex-col space-y-6 pb-6">{children}</div>
    </Page>
  );
};
