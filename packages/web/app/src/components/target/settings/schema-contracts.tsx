import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { Check, X } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TimeAgo } from '@/components/ui/time-ago';
import { DocsLink, Heading } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const SchemaContractsQuery = graphql(`
  query SchemaContractsQuery($selector: TargetSelectorInput!, $after: String) {
    target(selector: $selector) {
      id
      ...CreateContractDialogContentTargetFragment
      contracts(after: $after) {
        edges {
          node {
            id
            contractName
            includeTags
            excludeTags
            removeUnreachableTypesFromPublicApiSchema
            createdAt
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`);

export function SchemaContracts() {
  const router = useRouteSelector();

  const [schemaContractsQuery, reexecuteQuery] = useQuery({
    query: SchemaContractsQuery,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
    },
  });

  const contracts = schemaContractsQuery.data?.target?.contracts.edges;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schema Contracts</CardTitle>
        <CardDescription>
          Schema Contracts allow you to have separate public graphs that are a subset of the main
          graph.
        </CardDescription>
        <CardDescription>
          <DocsLink href="/todo" className="text-gray-500 hover:text-gray-300">
            Learn more about Schema Contracts
          </DocsLink>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="my-3.5 flex justify-between">
          <Dialog>
            <DialogTrigger>
              <Button>Create new contract</Button>
            </DialogTrigger>
            <DialogContent>
              <CreateContractDialogContent
                target={schemaContractsQuery.data?.target ?? null}
                onCreateContract={() => reexecuteQuery({ requestPolicy: 'network-only' })}
              />
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract Name</TableHead>
              <TableHead>Included Tags</TableHead>
              <TableHead>Excluded Tags</TableHead>
              <TableHead>Remove unreachable API Types</TableHead>
              <TableHead className="text-right">Created at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts?.map(({ node }) => (
              <TableRow key={node.id}>
                <TableCell>{node.contractName}</TableCell>
                <TableCell>
                  {node.includeTags?.map(tag => (
                    <Badge className="mr-1" key={tag}>
                      {tag}
                    </Badge>
                  )) ?? 'None'}
                </TableCell>
                <TableCell>
                  {node.excludeTags?.map(tag => (
                    <Badge className="mr-1" key={tag}>
                      {tag}
                    </Badge>
                  )) ?? 'None'}
                </TableCell>
                <TableCell className="text-center">
                  {node.removeUnreachableTypesFromPublicApiSchema ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <TimeAgo date={node.createdAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const CreateContractMutation = graphql(`
  mutation CreateSchemaContractMutation($input: CreateContractInput!) {
    createContract(input: $input) {
      ok {
        createdContract {
          id
          target {
            id
          }
          contractName
          includeTags
          excludeTags
          removeUnreachableTypesFromPublicApiSchema
          createdAt
        }
      }
      error {
        message
        details {
          targetId
          contractName
          includeTags
          excludeTags
        }
      }
    }
  }
`);

const CreateContractDialogContentTargetFragment = graphql(`
  fragment CreateContractDialogContentTargetFragment on Target {
    id
    latestSchemaVersion {
      id
      tags
    }
  }
`);

export function CreateContractDialogContent(props: {
  target: FragmentType<typeof CreateContractDialogContentTargetFragment> | null;
  onCreateContract: () => void;
}): ReactElement {
  const target = useFragment(CreateContractDialogContentTargetFragment, props.target);
  const [mutation, mutate] = useMutation(CreateContractMutation);
  const form = useFormik({
    enableReinitialize: true,
    initialValues: {
      contractName: '',
      includeTags: [] as Array<string>,
      includeTagsInput: '',
      excludeTags: [] as Array<string>,
      excludeTagsInput: '',
      removeUnreachableTypesFromPublicApiSchema: true,
    },
    validationSchema: Yup.object().shape({
      contractName: Yup.string().required('Required'),
      includeTagsInput: Yup.string(),
      excludeTagsInput: Yup.string(),
    }),
    onSubmit: values => {
      if (!target) {
        return;
      }

      return mutate({
        input: {
          targetId: target.id,
          contractName: values.contractName,
          includeTags: values.includeTags,
          excludeTags: values.excludeTags,
          removeUnreachableTypesFromPublicApiSchema:
            values.removeUnreachableTypesFromPublicApiSchema,
        },
      }).then(result => {
        if (result.data?.createContract.ok) {
          props.onCreateContract();
        }
      });
    },
  });

  return (
    <>
      {mutation.data?.createContract.ok ? (
        <div className="flex grow flex-col gap-5">
          <Heading className="text-center">Target successfully created!</Heading>
          <div>
            The first contract version will be published upon the next schema version is published.
          </div>
          <div className="grow" />
          <DialogClose asChild>
            <Button className="ml-auto">Ok, got it!</Button>
          </DialogClose>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit} className="flex flex-1 flex-col items-stretch gap-12">
          <div className="flex flex-col gap-5">
            <Heading className="text-center">Create Schema Contract</Heading>
            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold" htmlFor="buildUrl">
                Contract Name
              </label>
              <Input
                placeholder="Contract Name"
                name="contractName"
                value={form.values.contractName}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                disabled={form.isSubmitting}
                autoComplete="off"
              />
              <span className="text-sm text-red-500 after:content-['\200b']">
                {mutation.data?.createContract.error?.details?.contractName ??
                  form.errors.contractName}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold" htmlFor="includedTagsInput">
                Included Tags
              </label>
              <div className="flex">
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="flex w-full max-w-sm items-center space-x-2">
                        <Input
                          id="includeTagsInput"
                          name="includeTagsInput"
                          autoComplete="off"
                          value={form.values.includeTagsInput}
                          onChange={form.handleChange}
                          onBlur={form.handleBlur}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void form.setValues(values => ({
                                ...values,
                                includeTagsInput: '',
                                includeTags: values.includeTags.includes(values.includeTagsInput)
                                  ? values.includeTags
                                  : [...values.includeTags, values.includeTagsInput],
                              }));
                            }
                          }}
                          placeholder="Add included tag"
                          disabled={form.isSubmitting}
                        />
                        <Button
                          type="submit"
                          onClick={() => {
                            void form.setValues(values => ({
                              ...values,
                              includeTagsInput: '',
                              includeTags: values.includeTags.includes(values.includeTagsInput)
                                ? values.includeTags
                                : [...values.includeTags, values.includeTagsInput],
                            }));
                          }}
                          disabled={form.isSubmitting || form.values.includeTagsInput === ''}
                        >
                          Add
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[200px] p-0"
                      onOpenAutoFocus={ev => ev.preventDefault()}
                    >
                      <Command>
                        <CommandList>
                          <CommandGroup heading="Tags from latest schema version">
                            {target?.latestSchemaVersion?.tags?.map(value => (
                              <CommandItem
                                key={value}
                                value={value}
                                onSelect={currentValue => {
                                  void form.setValues(values => ({
                                    ...values,
                                    includeTags: values.includeTags.includes(currentValue)
                                      ? values.includeTags.filter(value => currentValue !== value)
                                      : [...values.includeTags, currentValue],
                                  }));
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    form.values.includeTags.includes(value)
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                                {value}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="mt-2 text-sm text-red-500 after:content-['\200b']">
                    {mutation.data?.createContract.error?.details?.includeTags ??
                      form.errors.includeTags}
                  </div>
                </div>
                <div className="flex-1 pl-3">
                  {form.values.includeTags.map(value => (
                    <Badge
                      key={value}
                      className="mr-1 cursor-pointer"
                      onClick={ev => {
                        void form.setValues(values => ({
                          ...values,
                          includeTags: values.includeTags.includes(value)
                            ? values.includeTags.filter(tagValue => tagValue !== value)
                            : [...values.includeTags, value],
                        }));
                        ev.stopPropagation();
                      }}
                    >
                      {value}
                      <X size={16} className="pl-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold" htmlFor="buildUrl">
                Excluded Tags
              </label>
              <div className="flex">
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="flex w-full max-w-sm items-center space-x-2">
                        <Input
                          id="excludeTagsInput"
                          name="excludeTagsInput"
                          autoComplete="off"
                          value={form.values.excludeTagsInput}
                          onChange={form.handleChange}
                          onBlur={form.handleBlur}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void form.setValues(values => ({
                                ...values,
                                excludeTagsInput: '',
                                excludeTags: values.excludeTags.includes(values.excludeTagsInput)
                                  ? values.excludeTags
                                  : [...values.excludeTags, values.excludeTagsInput],
                              }));
                            }
                          }}
                          placeholder="Add excluded tag"
                          disabled={form.isSubmitting}
                        />
                        <Button
                          type="submit"
                          onClick={() => {
                            void form.setValues(values => ({
                              ...values,
                              excludeTagsInput: '',
                              excludeTags: values.excludeTags.includes(values.excludeTagsInput)
                                ? values.excludeTags
                                : [...values.excludeTags, values.excludeTagsInput],
                            }));
                          }}
                          disabled={form.isSubmitting || form.values.excludeTagsInput === ''}
                        >
                          Add
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[200px] p-0"
                      onOpenAutoFocus={ev => ev.preventDefault()}
                    >
                      <Command>
                        <CommandList>
                          <CommandGroup heading="Tags from latest schema version">
                            {target?.latestSchemaVersion?.tags?.map(value => (
                              <CommandItem
                                key={value}
                                value={value}
                                onSelect={currentValue => {
                                  void form.setValues(values => ({
                                    ...values,
                                    excludeTags: values.excludeTags.includes(currentValue)
                                      ? values.excludeTags.filter(value => currentValue !== value)
                                      : [...values.excludeTags, currentValue],
                                  }));
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    form.values.excludeTags.includes(value)
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                                {value}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="mt-2 text-sm text-red-500 after:content-['\200b']">
                    {mutation.data?.createContract.error?.details?.excludeTags ??
                      form.errors.excludeTags}
                  </div>
                </div>
                <div className="flex-1 pl-3">
                  {form.values.excludeTags.map(value => (
                    <Badge
                      key={value}
                      className="mr-1 cursor-pointer"
                      onClick={ev => {
                        void form.setValues(values => ({
                          ...values,
                          excludeTags: values.excludeTags.includes(value)
                            ? values.excludeTags.filter(tagValue => tagValue !== value)
                            : [...values.excludeTags, value],
                        }));
                        ev.stopPropagation();
                      }}
                    >
                      {value}
                      <X size={16} className="pl-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold" htmlFor="buildUrl">
                Remove unreachable Types
              </label>
              <div className="flex items-center pl-1 pt-2">
                <Checkbox
                  id="removeUnreachableTypesFromPublicApiSchema"
                  checked={form.values.removeUnreachableTypesFromPublicApiSchema}
                  value="removeUnreachableTypesFromPublicApiSchema"
                  onCheckedChange={newValue =>
                    form.setFieldValue('removeUnreachableTypesFromPublicApiSchema', newValue)
                  }
                  disabled={form.isSubmitting}
                />
                <label
                  htmlFor="removeUnreachableTypesFromPublicApiSchema"
                  className="ml-2 inline-block cursor-pointer text-sm text-gray-300"
                >
                  Remove unreachable types from public API schema
                </label>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>

              <Button type="submit" disabled={mutation.fetching}>
                Create Contract
              </Button>
            </DialogFooter>
          </div>
        </form>
      )}
    </>
  );
}
