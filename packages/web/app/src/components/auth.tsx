import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthCardHeader(props: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <CardHeader>
      <CardTitle className="text-2xl" data-cy="auth-card-header-title">
        {props.title}
      </CardTitle>
      {props.description ? (
        <CardDescription data-cy="auth-card-header-description">
          {props.description}
        </CardDescription>
      ) : null}
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
  return <Card className="mx-auto w-full md:max-w-md">{props.children}</Card>;
}
