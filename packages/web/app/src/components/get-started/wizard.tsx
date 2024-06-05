import { ReactElement } from 'react';
import { Circle, CircleCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function GetStartedWizard({
  isOpen,
  onClose,
  tasks,
  docsUrl,
}: {
  docsUrl: (path: string) => string;
  isOpen: boolean;
  onClose(): void;
  tasks: {
    creatingProject: boolean;
    publishingSchema: boolean;
    checkingSchema: boolean;
    invitingMembers: boolean;
    reportingOperations: boolean;
    enablingUsageBasedBreakingChanges: boolean;
  };
}): ReactElement {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Get Started</SheetTitle>
          <SheetDescription>
            Follow the steps to set up your organization and experience the full power of GraphQL
            Hive
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <Task
            link={docsUrl('/management/projects#create-a-new-project')}
            completed={tasks.creatingProject}
            title="Create a project"
            description="A project represents a GraphQL API"
          />
          <Task
            link={docsUrl('/features/schema-registry#publish-a-schema')}
            completed={tasks.publishingSchema}
            title="Publish a schema"
            description="Publish your first schema to the registry"
          />
          <Task
            link={docsUrl('/features/schema-registry#check-a-schema')}
            completed={tasks.checkingSchema}
            title="Check a schema"
            description="Run a schema check to validate your changes"
          />
          {'invitingMembers' in tasks && typeof tasks.invitingMembers === 'boolean' ? (
            <Task
              link={docsUrl('/management/organizations#members')}
              completed={tasks.invitingMembers}
              title="Invite members"
              description="Invite your team members to collaborate on your projects"
            />
          ) : null}

          <Task
            link={docsUrl('/features/usage-reporting')}
            completed={tasks.reportingOperations}
            title="Report operations"
            description="Collect and analyze your GraphQL API usage"
          />
          <Task
            link={docsUrl('/management/targets#conditional-breaking-changes')}
            completed={tasks.enablingUsageBasedBreakingChanges}
            title="Enable usage-based schema checking"
            description="Detect breaking changes based on real usage data"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Task({
  completed,
  link,
  title,
  description,
}: {
  completed: boolean;
  title: string;
  description: string;
  link: string | null;
}) {
  return (
    <a
      href={link ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'relative block rounded-lg border border-gray-800 bg-gray-900 p-4 hover:bg-gray-800',
        completed ? 'opacity-70' : null,
      )}
    >
      <div className="flex items-start space-x-3">
        {completed ? (
          <CircleCheck className="size-5 text-orange-500" />
        ) : (
          <Circle className="size-5 text-orange-500" />
        )}
        <div className="w-0 flex-1">
          <p className="font-medium leading-5 text-white">{title}</p>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
      </div>
    </a>
  );
}
