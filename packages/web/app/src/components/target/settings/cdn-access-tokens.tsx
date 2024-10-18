import { ReactElement, useEffect, useState } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { DocsLink } from '@/components/ui/docs-note';
import { Heading } from '@/components/ui/heading';
import { AlertTriangleIcon, TrashIcon } from '@/components/ui/icon';
import { SubPageLayout, SubPageLayoutHeader } from '@/components/ui/page-content-layout';
import { Input, Modal, Table, Tag, TBody, Td, TimeAgo, Tr } from '@/components/v2';
import { InlineCode } from '@/components/v2/inline-code';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { canAccessTarget } from '@/lib/access/target';
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

function CreateCDNAccessTokenModal(props: {
  onCreateCDNAccessToken: () => void;
  onClose: () => void;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): ReactElement {
  const [createCdnAccessToken, mutate] = useMutation(CDNAccessTokenCreateMutation);

  const form = useFormik({
    enableReinitialize: true,
    initialValues: {
      alias: '',
    },
    validationSchema: Yup.object().shape({
      alias: Yup.string().required('Please enter an alias').min(3).max(100),
    }),
    onSubmit: async values => {
      await mutate({
        input: {
          selector: {
            organizationSlug: props.organizationSlug,
            projectSlug: props.projectSlug,
            targetSlug: props.targetSlug,
          },
          alias: values.alias,
        },
      });
    },
  });

  useEffect(() => {
    if (createCdnAccessToken.data?.createCdnAccessToken.ok?.createdCdnAccessToken.id) {
      props.onCreateCDNAccessToken();
    }
  }, [createCdnAccessToken.data?.createCdnAccessToken.ok?.createdCdnAccessToken.id]);

  let body = (
    <form className="flex flex-1 flex-col items-stretch gap-12" onSubmit={form.handleSubmit}>
      <div className="flex flex-col gap-5">
        <Heading className="text-center">Create CDN Access Token</Heading>
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-semibold" htmlFor="alias">
          CDN Access Token Alias
        </label>
        <Input
          placeholder="Alias"
          name="alias"
          value={form.values.alias}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          disabled={form.isSubmitting}
          isInvalid={form.touched.alias && !!form.errors.alias}
        />
        {form.touched.alias && form.errors.alias ? (
          <span className="text-sm text-red-500">{form.errors.alias}</span>
        ) : null}
      </div>

      <div className="mt-auto flex w-full gap-2 self-end">
        <Button
          variant="secondary"
          className="ml-auto"
          onClick={ev => {
            ev.preventDefault();
            props.onClose();
          }}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={createCdnAccessToken.fetching}>
          Create
        </Button>
      </div>
    </form>
  );

  if (createCdnAccessToken.data?.createCdnAccessToken.ok) {
    body = (
      <div className="flex flex-1 flex-col items-stretch gap-12">
        <div className="flex flex-col gap-5">
          <Heading className="text-center">Create CDN Access Token</Heading>
        </div>

        <p>The CDN Access Token was successfully created.</p>

        <div className="flex items-center gap-2 rounded-sm bg-yellow-500/10 p-4 text-yellow-500">
          <AlertTriangleIcon className="size-5" />
          <span>
            Please store this access token securely. You will not be able to see it again.
          </span>
        </div>

        <InlineCode content={createCdnAccessToken.data.createCdnAccessToken.ok.secretAccessToken} />

        <div className="mt-auto flex w-full gap-2 self-end">
          <Button className="ml-auto" onClick={props.onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  } else if (createCdnAccessToken.data?.createCdnAccessToken.error) {
    body = (
      <div className="flex flex-1 flex-col items-stretch gap-12">
        <div className="flex flex-col gap-5">
          <Heading className="text-center">Delete CDN Access Token</Heading>
        </div>

        <p>Something went wrong.</p>

        <Tag color="yellow" className="px-4 py-2.5">
          <AlertTriangleIcon className="size-5" />
          {createCdnAccessToken.data?.createCdnAccessToken.error.message}
        </Tag>

        <Button className="ml-auto" onClick={props.onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <Modal open className="w-[650px]" onOpenChange={props.onClose}>
      {body}
    </Modal>
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
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
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
    <div className="flex flex-1 flex-col items-stretch gap-12">
      <div className="flex flex-col gap-5">
        <Heading className="text-center">Delete CDN Access Tokens</Heading>
      </div>
      <Tag color="yellow" className="px-4 py-2.5">
        <AlertTriangleIcon className="size-5" />
        Deleting an CDN access token can not be undone. After deleting the access token it might
        take up to 5 minutes before the changes are propagated across the CDN.
      </Tag>
      <p>Are you sure you want to delete the CDN Access Token?</p>

      <div className="mt-auto flex w-full gap-2 self-end">
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
                  organizationSlug: props.organizationSlug,
                  projectSlug: props.projectSlug,
                  targetSlug: props.targetSlug,
                },
                cdnAccessTokenId: props.cdnAccessTokenId,
              },
            })
          }
        >
          Delete
        </Button>
      </div>
    </div>
  );

  if (deleteCdnAccessToken.data?.deleteCdnAccessToken.ok) {
    body = (
      <div className="flex flex-1 flex-col items-stretch gap-12">
        <div className="flex flex-col gap-5">
          <Heading className="text-center">Delete CDN Access Token</Heading>
        </div>

        <p>The CDN Access Token was successfully deleted.</p>

        <Tag color="yellow" className="px-4 py-2.5">
          <AlertTriangleIcon className="size-5" />
          It can take up to 5 minutes before the changes are propagated across the CDN.
        </Tag>
        <div className="mt-auto flex w-full gap-2 self-end">
          <Button className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  } else if (deleteCdnAccessToken.data?.deleteCdnAccessToken.error) {
    body = (
      <div className="flex flex-1 flex-col items-stretch gap-12">
        <div className="flex flex-col gap-5">
          <Heading className="text-center">Delete CDN Access Token</Heading>
        </div>

        <p>Something went wrong.</p>

        <Tag color="yellow" className="px-4 py-2.5">
          <AlertTriangleIcon className="size-5" />
          {deleteCdnAccessToken.data?.deleteCdnAccessToken.error.message}
        </Tag>
        <div className="mt-auto flex w-full gap-2 self-end">
          <Button className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Modal open className="w-[650px]" onOpenChange={onClose}>
      {body}
    </Modal>
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
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
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
        organizationSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
        targetSlug: props.targetSlug,
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
                  {canManage ? (
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
                  ) : null}
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
          organizationSlug={props.organizationSlug}
          projectSlug={props.projectSlug}
          targetSlug={props.targetSlug}
        />
      ) : null}
      {searchParams.cdn === 'delete' ? (
        <DeleteCDNAccessTokenModal
          cdnAccessTokenId={searchParams.id}
          onDeletedAccessTokenId={() => {
            reexecuteQuery({ requestPolicy: 'network-only' });
          }}
          onClose={closeModal}
          organizationSlug={props.organizationSlug}
          projectSlug={props.projectSlug}
          targetSlug={props.targetSlug}
        />
      ) : null}
    </SubPageLayout>
  );
}
