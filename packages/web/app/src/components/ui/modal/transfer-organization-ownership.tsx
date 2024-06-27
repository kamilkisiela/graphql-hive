import { ReactElement, useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, UseQueryState } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckIcon } from '@/components/v2/icon';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TransferOrganizationOwnership_MembersQuery } from '@/gql/graphql';
import { useNotifications } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { CaretSortIcon } from '@radix-ui/react-icons';
import { useRouter } from '@tanstack/react-router';

const TransferOrganizationOwnership_Request = graphql(`
  mutation TransferOrganizationOwnership_Request($input: RequestOrganizationTransferInput!) {
    requestOrganizationTransfer(input: $input) {
      ok {
        email
      }
      error {
        message
      }
    }
  }
`);

const TransferOrganizationOwnership_Members = graphql(`
  query TransferOrganizationOwnership_Members($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        cleanId
        name
        members {
          nodes {
            id
            isOwner
            ...MemberFields
            user {
              id
              fullName
              displayName
              email
            }
          }
          total
        }
      }
    }
  }
`);

const MemberFields = graphql(`
  fragment MemberFields on Member {
    id
    user {
      id
      fullName
      displayName
      email
    }
    isOwner
    organizationAccessScopes
    projectAccessScopes
    targetAccessScopes
  }
`);

export type MemberFromFragment = NonNullable<
  FragmentType<typeof MemberFields>[' $fragmentRefs']
>['MemberFieldsFragment'];

const TransferOrganizationOwnershipModal_OrganizationFragment = graphql(`
  fragment TransferOrganizationOwnershipModal_OrganizationFragment on Organization {
    id
    cleanId
  }
`);

export const TransferOrganizationOwnershipModal = ({
  isOpen,
  toggleModalOpen,
  organization,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: FragmentType<typeof TransferOrganizationOwnershipModal_OrganizationFragment>;
}): ReactElement => {
  const orgFragment = useFragment(
    TransferOrganizationOwnershipModal_OrganizationFragment,
    organization,
  );
  const [query] = useQuery({
    query: TransferOrganizationOwnership_Members,
    variables: { selector: { organization: orgFragment.cleanId } },
  });

  return (
    <TransferOrganizationOwnershipModalForm
      organization={orgFragment}
      toggleModalOpen={toggleModalOpen}
      isOpen={isOpen}
      query={query}
    />
  );
};

type Option = {
  value: string;
  label: string;
};

export const TransferOrganizationOwnershipModalForm = ({
  organization,
  toggleModalOpen,
  isOpen,
  query,
}: {
  organization: { cleanId: string };
  toggleModalOpen: () => void;
  isOpen: boolean;
  query: UseQueryState<
    TransferOrganizationOwnership_MembersQuery,
    { selector: { organization: string } }
  >;
}): ReactElement => {
  const notify = useNotifications();
  const [, mutate] = useMutation(TransferOrganizationOwnership_Request);
  const router = useRouter();

  const [searchPhrase, setSearchPhrase] = useState('');
  const normalizedSearchPhrase = searchPhrase.toLowerCase().replace(/\s+/g, '');

  const schema = z.object({
    newOwner: z.string().min(1, 'New owner is not defined'),
    confirmation: z
      .string()
      .min(1)
      .refine(val => val === organization.cleanId, 'Type organization name to confirm'),
  });

  type FormValues = z.infer<typeof schema>;

  const onSubmit = async (values: FormValues) => {
    const result = await mutate({
      input: { organization: organization.cleanId, user: values.newOwner },
    });

    if (result.error) {
      notify('Failed to transfer ownership', 'error');
      return;
    }

    const errorMessage = result.data?.requestOrganizationTransfer.error?.message;
    if (errorMessage) {
      notify(errorMessage, 'error');
      return;
    }

    if (result.data?.requestOrganizationTransfer.ok) {
      notify('Ownership transfer requested', 'success');
      toggleModalOpen();
    }
  };

  const members = (query.data?.organization?.organization.members.nodes ?? []).filter(
    member => !member.isOwner,
  );

  const [openPopup, setOpenPopup] = useState(false);
  const [selected, setSelected] = useState<MemberFromFragment | undefined>();

  const options = members.map(member => ({
    value: member.id,
    label: member.user.fullName,
  })) as Option[];

  const onSelect = useCallback(
    (option: Option) => {
      const member = members.find(m => m.id === option.value);
      setSelected(member as MemberFromFragment);
      setSearchPhrase(option.value === searchPhrase ? '' : option.value);
    },
    [members, searchPhrase],
  );

  const handleRoute = () => {
    void router.navigate({
      to: '/$organizationId/view/members',
      params: { organizationId: organization.cleanId },
      search: { page: 'list' },
    });
  };

  return (
    <TransferOrganizationOwnershipModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      openPopup={openPopup}
      setOpenPopup={setOpenPopup}
      searchPhrase={searchPhrase}
      options={options}
      handleRoute={handleRoute}
      selected={selected}
      onSelect={onSelect}
      organization={organization}
      schema={schema}
      onSubmit={onSubmit}
    />
  );
};

export const TransferOrganizationOwnershipModalContent = ({
  isOpen,
  toggleModalOpen,
  openPopup,
  setOpenPopup,
  searchPhrase,
  options,
  handleRoute,
  selected,
  onSelect,
  organization,
  schema,
  onSubmit,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  openPopup: boolean;
  setOpenPopup: (value: boolean) => void;
  searchPhrase: string;
  options: Option[];
  handleRoute: () => void;
  selected: MemberFromFragment | undefined;
  onSelect: (option: Option) => void;
  organization: { cleanId: string };
  schema: z.ZodObject<{
    newOwner: z.ZodString;
    confirmation: z.ZodEffects<z.ZodString, string, string>;
  }>;
  onSubmit: (values: { newOwner: string; confirmation: string }) => Promise<void>;
}): ReactElement => {
  const form = useForm<z.infer<typeof schema>>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: { newOwner: '', confirmation: '' },
  });

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      <DialogContent className="flex w-[800px] flex-col items-center gap-5">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
        </DialogHeader>
        <DialogDescription className="flex flex-col gap-2">
          Transferring is completed after the new owner approves the transfer.
          <Popover open={openPopup} onOpenChange={setOpenPopup}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openPopup}
                className="w-full justify-between"
              >
                {searchPhrase
                  ? options.find(option => option.value === searchPhrase)?.label
                  : 'Select new owner...'}
                <CaretSortIcon className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search new owner..." className="h-9 w-[410px]" />
                <CommandList>
                  <CommandEmpty>No new owner found.</CommandEmpty>
                  <CommandGroup>
                    {options.length === 0 ? (
                      <CommandItem className="cursor-pointer" onSelect={handleRoute}>
                        Visit Members page to add new owner before transferring.
                      </CommandItem>
                    ) : (
                      options.map(option => (
                        <CommandItem
                          key={option.value}
                          value={selected?.user.id}
                          onSelect={() => onSelect(option)}
                        >
                          {option.label}
                          <CheckIcon
                            className={cn(
                              'ml-auto size-4',
                              searchPhrase === option.value ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="flex flex-col gap-2">
            <div>
              Type <span className="font-bold text-white">{organization.cleanId}</span> to confirm.
            </div>
            <Controller
              name="confirmation"
              control={form.control}
              render={({ field }) => (
                <Input {...field} disabled={form.formState.isSubmitting} className="w-full" />
              )}
            />
            {form.formState.errors.confirmation && (
              <p className="text-red-500">{form.formState.errors.confirmation.message}</p>
            )}
          </div>
          <div className="h-0 w-full border-t-2 border-gray-900" />
          <div className="font-bold">About the ownership transfer</div>
          <ul className="list-disc px-3 text-sm text-white">
            <li className="pt-5">
              The new owner will receive a confirmation email. If the new owner doesn't accept the
              transfer within 24 hours, the invitation will expire.
            </li>
            <li className="pt-5">
              When you transfer an organization to one of the members, the new owner will get access
              to organization's contents, projects, members, and settings.
            </li>
            <li className="pt-5">
              You will keep your access to the organization's contents, projects, members, and
              settings, except you won't be able to remove the organization.
            </li>
          </ul>
        </DialogDescription>
        <DialogFooter className="flex w-full gap-2">
          <Button
            type="button"
            className="w-full justify-center"
            size="lg"
            variant="default"
            onClick={toggleModalOpen}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="w-full justify-center"
            variant="primary"
            disabled={form.formState.isSubmitting || !form.formState.isValid}
            onClick={form.handleSubmit(onSubmit)}
          >
            Transfer this organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
