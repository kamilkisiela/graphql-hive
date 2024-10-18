import { useRouter } from '@tanstack/react-router';
import { Button } from '../ui/button';

export function ProjectMigrationToast(props: { projectSlug: string; organizationSlug: string }) {
  const router = useRouter();
  const handleOnClick = () => {
    void router.navigate({
      to: `/${props.organizationSlug}/${props.projectSlug}/view/settings`,
    });
  };
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
        onClick={handleOnClick}
        variant="link"
        size="sm"
        className="mr-2 self-center text-sm font-medium text-gray-300"
      >
        Migrate
      </Button>
    </div>
  );
}
