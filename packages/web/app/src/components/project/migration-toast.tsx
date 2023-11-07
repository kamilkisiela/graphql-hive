import { Button } from '@/components/v2';

export function ProjectMigrationToast({ projectId, orgId }: { projectId: string; orgId: string }) {
  return (
    <div className="fixed bottom-6 right-24 z-10 flex flex-row justify-center gap-6 rounded-md bg-gray-900 p-4">
      <div>
        <div className="mb-2 text-sm font-medium text-white">
          This project utilizes the outdated model of the registry
        </div>
        <p className="text-xs text-gray-400">
          For an optimized workflow, kindly switch to the modern model.
        </p>
        <p className="text-xs text-gray-400">
          The legacy model will cease to be accessible in a few months' time.
        </p>
      </div>
      <Button
        as="a"
        href={`/${orgId}/${projectId}/view/settings`}
        variant="link"
        size="small"
        className="mr-2 self-center text-sm font-medium text-gray-300"
      >
        Migrate
      </Button>
    </div>
  );
}
