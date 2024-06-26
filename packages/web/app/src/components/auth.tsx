import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HiveLogo } from '@/components/v2/icon';

export function AuthCardHeader(props: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <CardHeader>
      <div className="flex flex-row items-center justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-2xl">{props.title}</CardTitle>
          {props.description ? <CardDescription>{props.description}</CardDescription> : null}
        </div>
        <div>
          <HiveLogo animated={false} />
        </div>
      </div>
    </CardHeader>
  );
}

export const AuthCardContent = CardContent;

export function AuthCardStack(props: { children: React.ReactNode }) {
  return <div className="grid gap-y-4">{props.children}</div>;
}

export function AuthOrSeparator() {
  return (
    <div className="flex flex-row items-center justify-between gap-x-4">
      <div className="h-[1px] w-full bg-gray-700" />
      <div className="text-center text-gray-400">or</div>
      <div className="h-[1px] w-full bg-gray-700" />
    </div>
  );
}

export function AuthCard(props: { children: React.ReactNode; className?: string }) {
  return <Card className="mx-auto w-full max-w-md bg-[#101014]">{props.children}</Card>;
}
