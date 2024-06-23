import { ReactElement, useCallback, useState } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
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
import { useNotifications } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { CaretSortIcon } from '@radix-ui/react-icons';

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

type Member = NonNullable<
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
  ...props
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: FragmentType<typeof TransferOrganizationOwnershipModal_OrganizationFragment>;
}): ReactElement => {
  const organization = useFragment(
    TransferOrganizationOwnershipModal_OrganizationFragment,
    props.organization,
  );
  const notify = useNotifications();
  const [, mutate] = useMutation(TransferOrganizationOwnership_Request);
  const [query] = useQuery({
    query: TransferOrganizationOwnership_Members,
    variables: {
      selector: {
        organization: organization.cleanId,
      },
    },
  });

  const [searchPhrase, setSearchPhrase] = useState('');
  const normalizedSearchPhrase = searchPhrase.toLowerCase().replace(/\s+/g, '');

  const {
    handleSubmit,
    resetForm,
    values,
    handleChange,
    handleBlur,
    isSubmitting,
    isValid,
    errors,
    touched,
    setFieldValue,
  } = useFormik({
    enableReinitialize: true,
    initialValues: {
      newOwner: '',
      confirmation: '',
    },
    validationSchema: Yup.object().shape({
      newOwner: Yup.string().min(1).required('New owner is not defined'),
      confirmation: Yup.string()
        .min(1)
        .equals([organization.cleanId])
        .required('Type organization name to confirm'),
    }),
    onSubmit: async values => {
      const result = await mutate({
        input: {
          organization: organization.cleanId,
          user: values.newOwner,
        },
      });

      if (result.error) {
        notify('Failed to transfer ownership', 'error');
      }

      if (result.data?.requestOrganizationTransfer.error?.message) {
        notify(result.data.requestOrganizationTransfer.error.message, 'error');
      }

      if (result.data?.requestOrganizationTransfer.ok) {
        notify('Ownership transfer requested', 'success');
        resetForm();
        toggleModalOpen();
      }
    },
  });

  const [selected, setSelected] = useState<Member | undefined>();

  const onSelect = useCallback(
    (member: Member) => {
      setSelected(member);
      void setFieldValue('newOwner', member.user.id, true);
    },
    [setSelected, setFieldValue],
  );

  const members = (query.data?.organization?.organization.members.nodes ?? []).filter(
    member => !member.isOwner,
  );

  const filteredMembers = (
    searchPhrase === ''
      ? members
      : members.filter(
          member =>
            member.user.fullName
              .toLowerCase()
              .replace(/\s+/g, '')
              .includes(normalizedSearchPhrase) ||
            member.user.displayName
              .toLowerCase()
              .replace(/\s+/g, '')
              .includes(normalizedSearchPhrase) ||
            member.user.email.toLowerCase().replace(/\s+/g, '').includes(normalizedSearchPhrase),
        )
  )
    .map(m => m.user)
    .slice(0, 5);

  const [open, setOpen] = useState(false);

  const options = filteredMembers.map(member => ({
    value: member.id,
    label: member.fullName,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      <DialogContent className="flex w-[800px] flex-col items-center gap-5">
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
        </DialogHeader>
        <DialogDescription className="flex flex-col gap-2">
          Transferring is completed after the new owner approves the transfer.
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
              >
                {searchPhrase
                  ? options.find(option => option.value === searchPhrase)?.label
                  : 'Select new owner...'}
                <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search new owner..." className="h-9 w-[410px]" />
                <CommandList>
                  <CommandEmpty>No new owner found.</CommandEmpty>
                  <CommandGroup>
                    {options.length === 0 ? (
                      <CommandItem className="cursor-help">
                        Visit Members page to add new owner before transferring.
                      </CommandItem>
                    ) : (
                      options.map(option => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={currentValue => {
                            setSearchPhrase(currentValue === searchPhrase ? '' : currentValue);
                            setOpen(false);
                          }}
                        >
                          {option.label}
                          <CheckIcon
                            className={cn(
                              'ml-auto h-4 w-4',
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
            <Input
              name="confirmation"
              value={values.confirmation}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting || (touched.confirmation && !!errors.confirmation)}
              className="w-full"
            />
          </div>
          <div className="h-0 w-full border-t-2 border-gray-900" />
          <div className="font-bold">About the ownership transfer</div>
          <ul className="list-inside list-disc px-3 text-sm text-white">
            <li>
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
            onClick={toggleModalOpen}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="w-full justify-center"
            variant="default"
            disabled={isSubmitting || !isValid || !touched.confirmation || !touched.newOwner}
            onClick={() => handleSubmit()}
          >
            Transfer this organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
