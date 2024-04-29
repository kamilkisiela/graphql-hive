import { ReactElement } from 'react';
import Link from 'next/link';
import { LogOutIcon } from 'lucide-react';
import { authenticated } from '@/components/authenticated-container';
import { Button } from '@/components/ui/button';
import { DottedBackground } from '@/components/ui/dotted-background';
import { MetaTitle } from '@/components/v2';
import { HiveLogo } from '@/components/v2/icon';
import { CreateOrganizationForm } from '@/components/v2/modals/create-organization';
import { useRouter } from '@/lib/hooks/use-route-selector';

function CreateOrgPage(): ReactElement {
  const router = useRouter();
  return (
    <>
      <MetaTitle title="Create Organization" />
      <DottedBackground>
        <div className="flex h-full grow items-center">
          <Button
            variant="outline"
            onClick={() => router.push('/logout')}
            className="absolute right-6 top-6"
          >
            <LogOutIcon className="mr-2 size-4" /> Sign out
          </Button>
          <Link href="/" className="absolute left-6 top-6">
            <HiveLogo className="size-10" />
          </Link>
          <div className="container w-1/3">
            <CreateOrganizationForm />
          </div>
        </div>
      </DottedBackground>
    </>
  );
}

export default authenticated(CreateOrgPage);
