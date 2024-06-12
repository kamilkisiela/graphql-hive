import { ReactElement } from 'react';
import { FragmentType, graphql, useFragment } from '@/gql';
import { getDocsUrl } from '@/lib/docs-url';
import { useToggle } from '@/lib/hooks';
import { GetStartedWizard } from './wizard';

const GetStartedWizard_GetStartedProgress = graphql(`
  fragment GetStartedWizard_GetStartedProgress on OrganizationGetStarted {
    creatingProject
    publishingSchema
    checkingSchema
    invitingMembers
    reportingOperations
    enablingUsageBasedBreakingChanges
  }
`);

export function GetStartedProgress(props: {
  tasks: FragmentType<typeof GetStartedWizard_GetStartedProgress>;
}): ReactElement | null {
  const [isOpen, toggle] = useToggle();
  const tasks = useFragment(GetStartedWizard_GetStartedProgress, props.tasks);

  if (!tasks) {
    return null;
  }

  const values = Object.values(tasks).filter(v => typeof v === 'boolean');
  const total = values.length;
  const completed = values.filter(t => t === true).length;
  const remaining = total - completed;

  if (remaining === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={toggle}
        className="cursor-pointer rounded px-4 py-2 text-left hover:opacity-80"
      >
        <div className="text-sm font-medium">Get Started</div>
        <div className="text-xs text-gray-500">
          {remaining} remaining task{remaining > 1 ? 's' : ''}
        </div>
        <div>
          <div className="relative mt-1 h-[5px] w-full overflow-hidden rounded bg-gray-800">
            <div
              className="h-full bg-orange-500"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>
      </button>
      <GetStartedWizard isOpen={isOpen} onClose={toggle} tasks={tasks} docsUrl={getDocsUrl} />
    </>
  );
}
