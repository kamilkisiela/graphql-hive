import { ReactElement, useEffect, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation, UseMutationState, useQuery } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocsLink } from '@/components/ui/docs-note';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { TrashIcon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SubPageLayout, SubPageLayoutHeader } from '@/components/ui/page-content-layout';
import { useToast } from '@/components/ui/use-toast';
import { Table, TBody, Td, TimeAgo, Tr } from '@/components/v2';
import { InlineCode } from '@/components/v2/inline-code';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  CdnAccessTokens_CdnAccessTokenCreateMutationMutation,
  CdnAccessTokens_DeleteCdnAccessTokenMutation,
  TargetAccessScope,
} from '@/gql/graphql';
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

const createCDNAccessTokenModalFormSchema = z.object({
  alias: z.string().min(3).max(100),
});

type CreateCDNAccessTokenModalFormValues = z.infer<typeof createCDNAccessTokenModalFormSchema>;

function CreateCDNAccessTokenModal(props: {
  onCreateCDNAccessToken: () => void;
  onClose: () => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const [createCdnAccessToken, mutate] = useMutation(CDNAccessTokenCreateMutation);

  const form = useForm<CreateCDNAccessTokenModalFormValues>({
    mode: 'onBlur',
    resolver: zodResolver(createCDNAccessTokenModalFormSchema),
    defaultValues: {
      alias: '',
    },
  });

  async function onSubmit(values: CreateCDNAccessTokenModalFormValues) {
    const result = await mutate({
      input: {
        selector: {
          organization: props.organizationId,
          project: props.projectId,
          target: props.targetId,
        },
        alias: values.alias,
      },
    });

    if (result.data?.createCdnAccessToken.ok) {
      props.onCreateCDNAccessToken();
    }
  }

  useEffect(() => {
    if (createCdnAccessToken.data?.createCdnAccessToken.ok?.createdCdnAccessToken.id) {
      props.onCreateCDNAccessToken();
    }
  }, [createCdnAccessToken.data?.createCdnAccessToken.ok?.createdCdnAccessToken.id]);

  return (
    <CreateCDNAccessTokenModalContent
      form={form}
      createCdnAccessToken={createCdnAccessToken}
      onSubmit={onSubmit}
      onClose={props.onClose}
    />
  );
}

export function CreateCDNAccessTokenModalContent(props: {
  form: UseFormReturn<z.infer<typeof createCDNAccessTokenModalFormSchema>>;
  createCdnAccessToken: UseMutationState<CdnAccessTokens_CdnAccessTokenCreateMutationMutation>;
  onSubmit: (values: CreateCDNAccessTokenModalFormValues) => void;
  onClose: () => void;
}) {
  let body = (
    <DialogContent className="container w-4/5 max-w-[650px] md:w-3/5">
      <Form {...props.form}>
        <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create CDN Access Token</DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <FormField
              control={props.form.control}
              name="alias"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>CDN Access Token Alias</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Alias"
                        disabled={props.form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="lg"
              className="w-full justify-center"
              onClick={ev => {
                ev.preventDefault();
                props.onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full justify-center"
              variant="primary"
              disabled={
                props.form.formState.isSubmitting ||
                props.createCdnAccessToken.fetching ||
                !props.form.formState.isValid
              }
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );

  if (props.createCdnAccessToken.data?.createCdnAccessToken.ok) {
    body = (
      <DialogContent className="container w-4/5 max-w-[650px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Create CDN Access Token</DialogTitle>
          <DialogDescription>The CDN Access Token was successfully created.</DialogDescription>
          <Callout type="warning">
            Please store this access token securely. You will not be able to see it again.
          </Callout>
        </DialogHeader>
        <InlineCode
          content={props.createCdnAccessToken.data.createCdnAccessToken.ok.secretAccessToken}
        />
        <DialogFooter>
          <Button
            size="lg"
            className="w-full justify-center"
            onClick={ev => {
              ev.preventDefault();
              props.onClose();
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  } else if (props.createCdnAccessToken.data?.createCdnAccessToken.error) {
    body = (
      <DialogContent className="container w-4/5 max-w-[650px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Delete CDN Access Token</DialogTitle>
          <DialogDescription>Something went wrong.</DialogDescription>
          <Callout type="error">
            {props.createCdnAccessToken.data?.createCdnAccessToken.error.message}
          </Callout>
        </DialogHeader>
        <DialogFooter>
          <Button
            size="lg"
            className="w-full justify-center"
            onClick={ev => {
              ev.preventDefault();
              props.onClose();
            }}
          >
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
  const { toast } = useToast();

  useEffect(() => {
    if (deleteCdnAccessToken.data?.deleteCdnAccessToken.ok?.deletedCdnAccessTokenId) {
      props.onDeletedAccessTokenId(
        deleteCdnAccessToken.data.deleteCdnAccessToken.ok.deletedCdnAccessTokenId,
      );
    }
  }, [deleteCdnAccessToken.data?.deleteCdnAccessToken.ok?.deletedCdnAccessTokenId ?? null]);

  const onConfirmDelete = async () => {
    const result = await mutate({
      input: {
        selector: {
          organization: props.organizationId,
          project: props.projectId,
          target: props.targetId,
        },
        cdnAccessTokenId: props.cdnAccessTokenId,
      },
    });
    if (result.error) {
      toast({
        title: 'Error',
        description: result.error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'CDN Access Token was successfully deleted.',
        variant: 'default',
      });
    }
  };

  return (
    <DeleteCDNAccessTokenModalContent
      onConfirmDelete={onConfirmDelete}
      onClose={props.onClose}
      deleteCdnAccessToken={deleteCdnAccessToken}
    />
  );
}

export function DeleteCDNAccessTokenModalContent(props: {
  onClose: () => void;
  onConfirmDelete: () => void;
  deleteCdnAccessToken: UseMutationState<CdnAccessTokens_DeleteCdnAccessTokenMutation>;
}) {
  let body = (
    <DialogContent className="container w-4/5 max-w-[650px] md:w-3/5">
      <DialogHeader>
        <DialogTitle>Delete CDN Access Tokens</DialogTitle>
        <DialogDescription>Deleting an CDN access token can not be undone.</DialogDescription>
        <DialogDescription>Are you sure you want to delete the CDN Access Token?</DialogDescription>
      </DialogHeader>
      <Callout className="m-0" type="info">
        After deleting the access token it might take up to 5 minutes before the changes are
        propagated across the CDN.
      </Callout>
      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          onClick={ev => {
            ev.preventDefault();
            props.onClose();
          }}
        >
          Cancel
        </Button>
        <Button variant="destructive" onClick={props.onConfirmDelete}>
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (props.deleteCdnAccessToken.data?.deleteCdnAccessToken.ok) {
    body = (
      <DialogContent className="container w-4/5 max-w-[650px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Delete CDN Access Tokens</DialogTitle>
          <DialogDescription>The CDN Access Token was successfully deleted.</DialogDescription>
        </DialogHeader>
        <Callout className="m-0" type="warning">
          It can take up to 5 minutes before the changes are propagated across the CDN.
        </Callout>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={ev => {
              ev.preventDefault();
              props.onClose();
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  } else if (props.deleteCdnAccessToken.data?.deleteCdnAccessToken.error) {
    body = (
      <DialogContent className="container w-4/5 max-w-[650px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Delete CDN Access Tokens</DialogTitle>
          <DialogDescription>Something went wrong.</DialogDescription>
        </DialogHeader>
        <Callout className="m-0" type="error">
          {props.deleteCdnAccessToken.data?.deleteCdnAccessToken.error.message}
        </Callout>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={ev => {
              ev.preventDefault();
              props.onClose();
            }}
          >
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
        subPageTitle="CDN Access Token"
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
