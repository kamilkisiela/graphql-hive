import React from 'react';
import clsx from 'clsx';
import { VscIssues, VscPass } from 'react-icons/vsc';
import { DocumentType, gql } from 'urql';
import { OrganizationType } from '@/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  useDisclosure,
} from '@chakra-ui/react';

const GetStartedWizard_GetStartedProgress = gql(/* GraphQL */ `
  fragment GetStartedWizard_GetStartedProgress on OrganizationGetStarted {
    creatingProject
    publishingSchema
    checkingSchema
    invitingMembers
    reportingOperations
    enablingUsageBasedBreakingChanges
  }
`);

export function GetStartedProgress({
  tasks,
  organizationType,
}: {
  tasks: DocumentType<typeof GetStartedWizard_GetStartedProgress>;
  organizationType: OrganizationType;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  if (!tasks) {
    return null;
  }

  const processedTasks =
    organizationType === OrganizationType.Personal
      ? {
          ...tasks,
          invitingMembers: undefined,
        }
      : tasks;
  const values = Object.values(processedTasks).filter(v => typeof v === 'boolean');
  const total = values.length;
  const completed = values.filter(t => t === true).length;
  const remaining = total - completed;

  if (remaining === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={onOpen}
        className="cursor-pointer rounded px-4 py-2 text-left hover:opacity-80"
        ref={triggerRef}
      >
        <div className="text-sm font-medium">Get Started</div>
        <div className="text-xs text-gray-500">
          {remaining} remaining task{remaining > 1 ? 's' : ''}
        </div>
        <div>
          <div
            className="relative mt-1 w-full overflow-hidden rounded bg-gray-800"
            style={{
              height: 5,
            }}
          >
            <div
              className="h-full bg-orange-500"
              style={{
                width: `${(completed / total) * 100}%`,
              }}
            />
          </div>
        </div>
      </button>
      <GetStartedWizard
        isOpen={isOpen}
        onClose={onClose}
        triggerRef={triggerRef}
        tasks={processedTasks}
      />
    </>
  );
}

function GetStartedWizard({
  isOpen,
  onClose,
  triggerRef,
  tasks,
}: {
  isOpen: boolean;
  onClose(): void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  tasks:
    | DocumentType<typeof GetStartedWizard_GetStartedProgress>
    | Omit<DocumentType<typeof GetStartedWizard_GetStartedProgress>, 'invitingMembers'>;
}) {
  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      finalFocusRef={triggerRef}
      size="md"
    >
      <DrawerOverlay />
      <DrawerContent bgColor="gray.800">
        <DrawerCloseButton />
        <DrawerHeader>Get Started</DrawerHeader>
        <DrawerBody>
          <p>Complete these steps to experience the full power of GraphQL Hive</p>
          <div className="mt-4 flex flex-col divide-y-2 divide-gray-900">
            <Task link={getDocsUrl('/get-started/projects')} completed={tasks.creatingProject}>
              Create a project
            </Task>
            <Task link={getDocsUrl('/features/publish-schema')} completed={tasks.publishingSchema}>
              Publish a schema
            </Task>
            <Task link={getDocsUrl('/features/checking-schema')} completed={tasks.checkingSchema}>
              Check a schema
            </Task>
            {'invitingMembers' in tasks && typeof tasks.invitingMembers === 'boolean' ? (
              <Task
                link={getDocsUrl('/get-started/organizations#members')}
                completed={tasks.invitingMembers}
              >
                Invite members
              </Task>
            ) : null}
            <Task link={getDocsUrl('/features/monitoring')} completed={tasks.reportingOperations}>
              Report operations
            </Task>
            <Task
              link={getDocsUrl('/features/checking-schema#with-usage-enabled')}
              completed={tasks.enablingUsageBasedBreakingChanges}
            >
              Enable usage-based breaking changes
            </Task>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function Task({
  completed,
  children,
  link,
}: React.PropsWithChildren<{
  completed: boolean;
  link: string | null;
}>) {
  return (
    <a
      href={link ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={clsx(
        'flex flex-row items-center gap-4 p-3 text-left',
        completed ? 'opacity-50 line-through' : 'hover:opacity-80',
      )}
    >
      {completed ? (
        <VscPass className="h-[20px] w-[20px] text-green-400" />
      ) : (
        <VscIssues className="h-[20px] w-[20px] text-green-400" />
      )}
      {children}
    </a>
  );
}
