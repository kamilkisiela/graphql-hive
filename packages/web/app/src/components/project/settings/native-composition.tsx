import { useCallback } from 'react';
import Link from 'next/link';
import { FlaskConicalIcon, HeartCrackIcon, PartyPopperIcon, RefreshCcwIcon } from 'lucide-react';
import { useMutation } from 'urql';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ProductUpdatesLink } from '@/components/v2/docs-note';
import { FragmentType, graphql, useFragment } from '@/gql';
import { NativeFederationCompatibilityStatus } from '@/gql/graphql';

const NativeCompositionSettings_OrganizationFragment = graphql(`
  fragment NativeCompositionSettings_OrganizationFragment on Organization {
    id
    cleanId
  }
`);

const NativeCompositionSettings_ProjectFragment = graphql(`
  fragment NativeCompositionSettings_ProjectFragment on Project {
    id
    cleanId
    nativeFederationCompatibility
    isNativeFederationEnabled
    externalSchemaComposition {
      endpoint
    }
  }
`);

const NativeCompositionSettings_UpdateNativeCompositionMutation = graphql(`
  mutation NativeCompositionSettings_UpdateNativeCompositionMutation(
    $input: UpdateNativeFederationInput!
  ) {
    updateNativeFederation(input: $input) {
      ok {
        ...NativeCompositionSettings_ProjectFragment
      }
      error {
        message
      }
    }
  }
`);

export function NativeCompositionSettings(props: {
  organization: FragmentType<typeof NativeCompositionSettings_OrganizationFragment>;
  project: FragmentType<typeof NativeCompositionSettings_ProjectFragment>;
}) {
  const organization = useFragment(
    NativeCompositionSettings_OrganizationFragment,
    props.organization,
  );
  const project = useFragment(NativeCompositionSettings_ProjectFragment, props.project);
  const [mutationState, mutate] = useMutation(
    NativeCompositionSettings_UpdateNativeCompositionMutation,
  );
  const { toast } = useToast();

  const update = useCallback(
    async (enabled: boolean) => {
      const action = enabled ? 'enabled' : 'disabled';

      try {
        const result = await mutate({
          input: {
            organization: organization.cleanId,
            project: project.cleanId,
            enabled,
          },
        });

        if (result.error) {
          toast({
            variant: 'destructive',
            title: `Failed to ${action} native composition`,
            description: result.error.message,
          });
        } else if (result.data?.updateNativeFederation.error) {
          toast({
            variant: 'destructive',
            title: `Failed to ${action} native composition`,
            description: result.data.updateNativeFederation.error.message,
          });
        } else if (result.data?.updateNativeFederation.ok) {
          toast({
            title: `Successfully ${action} native composition`,
            description: enabled
              ? project.externalSchemaComposition?.endpoint
                ? 'You can now disable external composition in your project settings.'
                : 'Your project is now using our Open Source composition library for Apollo Federation.'
              : 'Your project is no longer using our Open Source composition library for Apollo Federation.',
          });
        }
      } catch (error) {
        console.log(`Failed to ${action} native composition`);
        console.error(error);
        toast({
          variant: 'destructive',
          title: `Failed to ${action} native composition`,
          description: String(error),
        });
      }
    },
    [mutate, toast, organization.cleanId, project.cleanId],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a id="native-composition">Native Composition</a>
        </CardTitle>
        <CardDescription>Native Apollo Federation v2 support for your project.</CardDescription>
        {project.isNativeFederationEnabled ? null : (
          <CardDescription>
            <ProductUpdatesLink href="2023-10-10-native-federation-2">
              Read the announcement!
            </ProductUpdatesLink>
          </CardDescription>
        )}
      </CardHeader>

      {project.isNativeFederationEnabled ? null : (
        <CardContent>
          <div className="flex flex-row items-center gap-x-4">
            <div>
              {project.nativeFederationCompatibility ===
              NativeFederationCompatibilityStatus.Compatible ? (
                <PartyPopperIcon className="size-10 text-emerald-500" />
              ) : null}
              {project.nativeFederationCompatibility ===
              NativeFederationCompatibilityStatus.Incompatible ? (
                <HeartCrackIcon className="size-10 text-red-500" />
              ) : null}
              {project.nativeFederationCompatibility ===
              NativeFederationCompatibilityStatus.Unknown ? (
                <FlaskConicalIcon className="size-10 text-orange-500" />
              ) : null}
            </div>
            <div>
              <div className="text-base font-semibold">
                {project.nativeFederationCompatibility ===
                NativeFederationCompatibilityStatus.Compatible
                  ? 'Your project is compatible'
                  : null}
                {project.nativeFederationCompatibility ===
                NativeFederationCompatibilityStatus.Incompatible
                  ? 'Your project is not yet supported'
                  : null}
                {project.nativeFederationCompatibility ===
                NativeFederationCompatibilityStatus.Unknown
                  ? 'Unclear whether your project is compatible'
                  : null}
              </div>
              <div className="text-muted-foreground text-sm">
                {project.nativeFederationCompatibility ===
                NativeFederationCompatibilityStatus.Compatible ? (
                  <>
                    Subgraphs of this project are composed and validated correctly by our{' '}
                    <Link
                      className="text-muted-foreground font-semibold underline-offset-4 hover:underline"
                      href="https://github.com/the-guild-org/federation"
                    >
                      Open Source composition library
                    </Link>{' '}
                    for Apollo Federation.
                  </>
                ) : null}
                {project.nativeFederationCompatibility ===
                NativeFederationCompatibilityStatus.Incompatible ? (
                  <>
                    Our{' '}
                    <Link
                      className="text-muted-foreground font-semibold underline-offset-4 hover:underline"
                      href="https://github.com/the-guild-org/federation"
                    >
                      Open Source composition library
                    </Link>{' '}
                    is not yet compatible with subgraphs of your project. We're working on it!
                    <br />
                    Please reach out to us to explore solutions for addressing this issue.
                  </>
                ) : null}
                {project.nativeFederationCompatibility ===
                NativeFederationCompatibilityStatus.Unknown ? (
                  <>
                    Your project appears to lack any subgraphs at the moment, making it impossible
                    for us to assess compatibility with our{' '}
                    <Link
                      className="text-muted-foreground font-semibold underline-offset-4 hover:underline"
                      href="https://github.com/the-guild-org/federation"
                    >
                      Open Source composition library
                    </Link>
                    .
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      )}
      <CardFooter>
        <div className="flex flex-row items-center gap-x-2">
          <Button
            variant={project.isNativeFederationEnabled ? 'destructive' : 'default'}
            onClick={() => update(!project.isNativeFederationEnabled)}
            disabled={mutationState.fetching}
          >
            {mutationState.fetching ? (
              <>
                <RefreshCcwIcon className="mr-2 size-4 animate-spin" />
                Please wait
              </>
            ) : project.isNativeFederationEnabled ? (
              'Disable Native Composition'
            ) : (
              'Enable Native Composition'
            )}
          </Button>
          <div>
            <Button variant="link" className="text-orange-500" asChild>
              <Link href="https://github.com/the-guild-org/federation?tab=readme-ov-file#compatibility">
                Learn more about risks and compatibility with Apollo Composition
              </Link>
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
