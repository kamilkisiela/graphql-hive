import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import { LogOutIcon } from 'lucide-react';
import { authenticated } from '@/components/authenticated-container';
import { Button } from '@/components/ui/button';
import { MetaTitle } from '@/components/v2';
import { CreateOrganizationForm } from '@/components/v2/modals/create-organization';
import { withSessionProtection } from '@/lib/supertokens/guard';

function CreateOrgPage(): ReactElement {
  const router = useRouter();
  return (
    <>
      <MetaTitle title="Create Organization" />
      <div className="h-full grow flex items-center">
        <Button
          variant="outline"
          onClick={() => router.push('/logout')}
          className="absolute top-6 right-6"
        >
          <LogOutIcon className="mr-2 h-4 w-4" /> Sign out
        </Button>
        <div className="container w-1/3">
          <CreateOrganizationForm />
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(CreateOrgPage);
