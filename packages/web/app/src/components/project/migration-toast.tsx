import { Button } from '@/components/v2';

export function ProjectMigrationToast({ projectId, orgId }: { projectId: string; orgId: string }) {
  return (
    <div className="fixed right-6 bottom-6 p-4 rounded-md bg-gray-900 flex flex-row justify-center gap-6">
      <div>
        <div className="font-medium text-sm text-white mb-2">
          This project utilizes the outdated model of the registry
        </div>
        <p className="text-gray-400 text-xs">
          For an optimized workflow, kindly switch to the modern model.
        </p>
        <p className="text-gray-400 text-xs">
          The legacy model will cease to be accessible in a few months' time.
        </p>
      </div>
      <Button
        as="a"
        href={`/${orgId}/${projectId}/view/settings`}
        variant="link"
        size="small"
        className="shrink-1 mr-2 self-center text-sm font-medium text-gray-300"
      >
        Migrate
      </Button>
    </div>
  );
}
