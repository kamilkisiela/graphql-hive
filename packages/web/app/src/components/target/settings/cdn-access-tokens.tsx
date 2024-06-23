import { ReactElement, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { SubPageLayout, SubPageLayoutHeader } from '@/components/ui/page-content-layout';
import { DocsLink, Input, Table, Tag, TBody, Td, TimeAgo, Tr } from '@/components/v2';
import { AlertTriangleIcon, TrashIcon } from '@/components/v2/icon';
import { InlineCode } from '@/components/v2/inline-code';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { canAccessTarget } from '@/lib/access/target';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from '@tanstack/react-router';

const CDNAccessTokeRowFragment = graphql(`
  fragment CDNAccessTokens_CdnAccessTokenRowFragment on CdnAccessToken {
    id
    firstCharacters
    lastCharacters
    alias
    createdAt
  }
`);

const CDNAccessTokenCreateMutation = graphql(`
  mutation CDNAccessTokens_CDNAccessTokenCreateMutation($input: CreateCdnAccessTokenInput!) {
    createCdnAccessToken(input: $input) {
      error {
        message
      }
      ok {
        createdCdnAccessToken {
          id
          ...CDNAccessTokens_CdnAccessTokenRowFragment
        }
        secretAccessToken
      }
    }
  }
`);

const formSchema = z.object({
  alias: z
    .string({
      required_error: 'Please enter an alias',
    })
    .min(3, {
      message: 'Alias must be at least 3 characters long',
    })
    .max(100, {
      message: 'Alias must be at most 100 characters long',
    }),
});

function CreateCDNAccessTokenModal(props: {
  onCreateCDNAccessToken: () => void;
  onClose: () => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const [createCdnAccessToken, mutate] = useMutation(CDNAccessTokenCreateMutation);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: {
      alias: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await mutate({
      input: {
        selector: {
          organization: props.organizationId,
          project: props.projectId,
          target: props.targetId,
        },
        alias: values.alias,
      },
    });
  }

  useEffect(() => {
    if (createCdnAccessToken.data?.createCdnAccessToken.ok?.createdCdnAccessToken.id) {
      props.onCreateCDNAccessToken();
    }
  }, [createCdnAccessToken.data?.createCdnAccessToken.ok?.createdCdnAccessToken.id]);

  let body = (
    <DialogContent className="absolute w-[650px] max-w-none">
      <Form {...form}>
        <form
          className="flex flex-1 flex-col items-stretch gap-12"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <DialogHeader>
            <DialogTitle>Create CDN Access Token</DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>CDN Access Token Alias</FormLabel>
                    <FormControl>
                      <Input placeholder="Alias" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>
          <DialogFooter className="flex w-full gap-2">
            <Button className="w-full justify-center" variant="default" onClick={props.onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="w-full justify-center"
              type="submit"
              disabled={createCdnAccessToken.fetching || !form.formState.isValid}
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );

  if (createCdnAccessToken.data?.createCdnAccessToken.ok) {
    body = (
      <DialogContent className="absolute w-[650px] max-w-none">
        <DialogHeader>
          <DialogTitle>Create CDN Access Token</DialogTitle>
          <DialogDescription>
            <p>The CDN Access Token was successfully created.</p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-sm bg-yellow-500/10 p-4 text-yellow-500">
          <AlertTriangleIcon className="size-5" />
          <span>
            Please store this access token securely. You will not be able to see it again.
          </span>
        </div>

        <InlineCode content={createCdnAccessToken.data.createCdnAccessToken.ok.secretAccessToken} />
        <DialogFooter className="flex w-full gap-2">
          <Button className="w-full justify-center" onClick={props.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  } else if (createCdnAccessToken.data?.createCdnAccessToken.error) {
    body = (
      <DialogContent className="absolute w-[650px] max-w-none">
        <DialogHeader>
          <DialogTitle>Delete CDN Access Token</DialogTitle>
          <DialogDescription>
            <p>Something went wrong.</p>
          </DialogDescription>
        </DialogHeader>

        <Tag color="yellow" className="px-4 py-2.5">
          <AlertTriangleIcon className="size-5" />
          {createCdnAccessToken.data?.createCdnAccessToken.error.message}
        </Tag>

        <DialogFooter>
          <Button className="ml-auto" onClick={props.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <Dialog open onOpenChange={props.onClose}>
      {body}
    </Dialog>
  );
}

const CDNAccessTokenDeleteMutation = graphql(`
  mutation CDNAccessTokens_DeleteCDNAccessToken($input: DeleteCdnAccessTokenInput!) {
    deleteCdnAccessToken(input: $input) {
      error {
        message
      }
      ok {
        deletedCdnAccessTokenId
      }
    }
  }
`);

function DeleteCDNAccessTokenModal(props: {
  cdnAccessTokenId: string;
  onDeletedAccessTokenId: (deletedAccessTokenId: string) => void;
  onClose: () => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const [deleteCdnAccessToken, mutate] = useMutation(CDNAccessTokenDeleteMutation);

  useEffect(() => {
    if (deleteCdnAccessToken.data?.deleteCdnAccessToken.ok?.deletedCdnAccessTokenId) {
      props.onDeletedAccessTokenId(
        deleteCdnAccessToken.data.deleteCdnAccessToken.ok.deletedCdnAccessTokenId,
      );
    }
  }, [deleteCdnAccessToken.data?.deleteCdnAccessToken.ok?.deletedCdnAccessTokenId ?? null]);

  const onClose = () => props.onClose();

  let body = (
    <DialogContent className="absolute w-[650px] max-w-none">
      <DialogHeader>
        <DialogTitle>Delete CDN Access Tokens</DialogTitle>
      </DialogHeader>

      <Tag color="yellow" className="px-4 py-2.5">
        <AlertTriangleIcon className="size-5" />
        Deleting an CDN access token can not be undone. After deleting the access token it might
        take up to 5 minutes before the changes are propagated across the CDN.
      </Tag>
      <p>Are you sure you want to delete the CDN Access Token?</p>

      <DialogFooter>
        <Button className="ml-auto" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={deleteCdnAccessToken.fetching}
          variant="destructive"
          onClick={() =>
            mutate({
              input: {
                selector: {
                  organization: props.organizationId,
                  project: props.projectId,
                  target: props.targetId,
                },
                cdnAccessTokenId: props.cdnAccessTokenId,
              },
            })
          }
        >
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (deleteCdnAccessToken.data?.deleteCdnAccessToken.ok) {
    body = (
      <DialogContent className="absolute w-[650px] max-w-none">
        <DialogHeader>
          <DialogTitle>Delete CDN Access Token</DialogTitle>
          <DialogDescription>
            <p>The CDN Access Token was successfully deleted.</p>
          </DialogDescription>
        </DialogHeader>

        <Tag color="yellow" className="px-4 py-2.5">
          <AlertTriangleIcon className="size-5" />
          It can take up to 5 minutes before the changes are propagated across the CDN.
        </Tag>

        <DialogFooter>
          <Button className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  } else if (deleteCdnAccessToken.data?.deleteCdnAccessToken.error) {
    body = (
      <DialogContent className="absolute w-[650px] max-w-none">
        <DialogHeader>
          <DialogTitle>Delete CDN Access Token</DialogTitle>
          <DialogDescription>
            <p>Something went wrong.</p>
          </DialogDescription>
        </DialogHeader>

        <Tag color="yellow" className="px-4 py-2.5">
          <AlertTriangleIcon className="size-5" />
          {deleteCdnAccessToken.data?.deleteCdnAccessToken.error.message}
        </Tag>

        <DialogFooter>
          <Button className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      {body}
    </Dialog>
  );
}

const CDNAccessTokensQuery = graphql(`
  query CDNAccessTokensQuery($selector: TargetSelectorInput!, $first: Int!, $after: String) {
    target(selector: $selector) {
      id
      cdnAccessTokens(first: $first, after: $after) {
        edges {
          node {
            id
            ...CDNAccessTokens_CdnAccessTokenRowFragment
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
        }
      }
    }
  }
`);

const CDNAccessTokens_MeFragment = graphql(`
  fragment CDNAccessTokens_MeFragment on Member {
    ...CanAccessTarget_MemberFragment
  }
`);

const CDNSearchParams = z.discriminatedUnion('cdn', [
  z.object({
    cdn: z.literal('create').optional(),
  }),
  z.object({
    cdn: z.literal('delete'),
    id: z.string(),
  }),
]);

export function CDNAccessTokens(props: {
  me: FragmentType<typeof CDNAccessTokens_MeFragment>;
  organizationId: string;
  projectId: string;
  targetId: string;
}): React.ReactElement {
  const me = useFragment(CDNAccessTokens_MeFragment, props.me);

  const [endCursors, setEndCursors] = useState<Array<string>>([]);
  const router = useRouter();
  const searchParamsResult = CDNSearchParams.safeParse(router.latestLocation.search);

  if (!searchParamsResult.success) {
    console.error('Invalid search params', searchParamsResult.error);
  }

  const searchParams = searchParamsResult.data ?? { cdn: undefined };

  const closeModal = () => {
    void router.navigate({
      search: {
        page: 'cdn',
      },
    });
  };

  const [target, reexecuteQuery] = useQuery({
    query: CDNAccessTokensQuery,
    variables: {
      selector: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
      },
      first: 10,
      after: endCursors[endCursors.length - 1] ?? null,
    },
    requestPolicy: 'cache-and-network',
  });

  const canManage = canAccessTarget(TargetAccessScope.Settings, me);

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        title="CDN Access Token"
        description={
          <>
            <CardDescription>
              CDN Access Tokens are used to access to Hive High-Availability CDN and read your
              schema artifacts.
            </CardDescription>
            <CardDescription>
              <DocsLink
                href="/management/targets#cdn-access-tokens"
                className="text-gray-500 hover:text-gray-300"
              >
                Learn more about CDN Access Tokens
              </DocsLink>
            </CardDescription>
          </>
        }
      />
      {canManage && (
        <div className="my-3.5 flex justify-between">
          <Button asChild>
            <Link
              search={{
                page: 'cdn',
                cdn: 'create',
              }}
            >
              Create new CDN token
            </Link>
          </Button>
        </div>
      )}
      <Table>
        <TBody>
          {target?.data?.target?.cdnAccessTokens.edges?.map(edge => {
            const node = useFragment(CDNAccessTokeRowFragment, edge.node);

            return (
              <Tr key={node.id}>
                <Td>
                  {node.firstCharacters + new Array(10).fill('•').join('') + node.lastCharacters}
                </Td>
                <Td>{node.alias}</Td>
                <Td align="right">
                  created <TimeAgo date={node.createdAt} />
                </Td>
                <Td align="right">
                  <Button
                    className="hover:text-red-500"
                    variant="ghost"
                    onClick={() => {
                      void router.navigate({
                        search: {
                          page: 'cdn',
                          cdn: 'delete',
                          id: node.id,
                        },
                      });
                    }}
                  >
                    <TrashIcon />
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>

      <div className="my-3.5 flex justify-end">
        {target.data?.target?.cdnAccessTokens.pageInfo.hasPreviousPage ? (
          <Button
            variant="secondary"
            className="mr-2 px-5"
            onClick={() => {
              setEndCursors(cursors => {
                if (cursors.length === 0) {
                  return cursors;
                }
                return cursors.slice(0, cursors.length - 1);
              });
            }}
          >
            Previous Page
          </Button>
        ) : null}
        {target.data?.target?.cdnAccessTokens.pageInfo.hasNextPage ? (
          <Button
            variant="secondary"
            className="px-5"
            onClick={() => {
              setEndCursors(cursors => {
                if (!target.data?.target?.cdnAccessTokens.pageInfo.endCursor) {
                  return cursors;
                }
                return [...cursors, target.data?.target?.cdnAccessTokens.pageInfo.endCursor];
              });
            }}
          >
            Next Page
          </Button>
        ) : null}
      </div>

      {searchParams.cdn === 'create' ? (
        <CreateCDNAccessTokenModal
          onCreateCDNAccessToken={() => {
            reexecuteQuery({ requestPolicy: 'network-only' });
          }}
          onClose={closeModal}
          organizationId={props.organizationId}
          projectId={props.projectId}
          targetId={props.targetId}
        />
      ) : null}
      {searchParams.cdn === 'delete' ? (
        <DeleteCDNAccessTokenModal
          cdnAccessTokenId={searchParams.id}
          onDeletedAccessTokenId={() => {
            reexecuteQuery({ requestPolicy: 'network-only' });
          }}
          onClose={closeModal}
          organizationId={props.organizationId}
          projectId={props.projectId}
          targetId={props.targetId}
        />
      ) : null}
    </SubPageLayout>
  );
}
