import { Fragment, ReactElement, useCallback, useState } from 'react';
import clsx from 'clsx';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { Button, Heading, Input, Modal } from '@/components/v2';
import { ArrowDownIcon, CheckIcon } from '@/components/v2/icon';
import { FragmentType, graphql, useFragment } from '@/gql';
import { MemberFieldsFragment } from '@/graphql';
import { useNotifications } from '@/lib/hooks';
import { Combobox as HeadlessCombobox, Transition as HeadlessTransition } from '@headlessui/react';

const Combobox = HeadlessCombobox as any;
const Transition = HeadlessTransition as any;

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

type Member = MemberFieldsFragment;

const TransferOrganizationOwnershipModal_OrganizationFragment = graphql(`
  fragment TransferOrganizationOwnershipModal_OrganizationFragment on Organization {
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
      void setFieldValue('newOwner', member.id, true);
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

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} size="lg" className="flex flex-col gap-5">
      <Heading>Transfer ownership</Heading>

      <p>Transferring is completed after the new owner approves the transfer.</p>

      <div className="flex flex-col gap-2">
        <div className="font-bold">New owner</div>
        <Combobox value={selected} onChange={onSelect}>
          <div className="relative">
            <div
              className={clsx(
                'rounded-sm bg-gray-800 p-4 text-sm font-medium text-white ring-1 ring-gray-700 focus-within:ring',
                touched.newOwner && !!errors.newOwner
                  ? 'text-red-500 caret-white ring-red-500'
                  : null,
              )}
            >
              <Combobox.Input
                className="w-full bg-transparent placeholder:text-gray-500 disabled:cursor-not-allowed"
                name="newOwner"
                displayValue={(member: Member['user'] | null) => member?.displayName}
                onChange={(event: any) => setSearchPhrase(event.target.value)}
                onBlur={handleBlur}
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center px-6">
                <ArrowDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </Combobox.Button>
            </div>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              afterLeave={() => setSearchPhrase('')}
            >
              <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-800 text-base shadow-lg ring-1 ring-black/5 focus:outline-none">
                {filteredMembers.length === 0 && searchPhrase !== '' ? (
                  <div className="relative cursor-default select-none px-4 py-2 text-base text-gray-700">
                    Nothing found.
                  </div>
                ) : (
                  filteredMembers.map(member => (
                    <Combobox.Option
                      key={member.id}
                      className={({ active, selected }: { active?: boolean; selected?: boolean }) =>
                        clsx(
                          'relative cursor-pointer select-none p-2 font-medium text-gray-300',
                          active || selected ? 'bg-gray-900' : null,
                        )
                      }
                      value={member}
                    >
                      {({ selected }: { selected?: boolean }) => (
                        <div className="flex flex-row items-center justify-between gap-2">
                          {/* <div className="ml-2.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800">
                            <img src={member.image} className="block h-full w-full" />
                          </div> */}
                          <div className="ml-2 flex flex-1 flex-col gap-x-2">
                            <div className="block truncate text-sm">{member.displayName}</div>
                            <div className="text-xs font-normal text-gray-400">{member.email}</div>
                          </div>
                          {selected ? <CheckIcon /> : null}
                        </div>
                      )}
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Transition>
          </div>
        </Combobox>
      </div>

      <div className="flex flex-col gap-2">
        <div>
          Type <span className="font-bold">{organization.cleanId}</span> to confirm.
        </div>

        <Input
          name="confirmation"
          value={values.confirmation}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
          isInvalid={touched.confirmation && !!errors.confirmation}
          className="w-full"
        />
      </div>

      <div className="h-0 w-full border-t-2 border-gray-900" />

      <div className="font-bold">About the ownership transfer</div>
      <ul className="list-inside list-disc px-5 text-sm text-white">
        <li>
          The new owner will receive a confirmation email. If the new owner doesn't accept the
          transfer within 24 hours, the invitation will expire.
        </li>
        <li className="pt-5">
          When you transfer an organization to one of the members, the new owner will get access to
          organization's contents, projects, members, and settings.
        </li>
        <li className="pt-5">
          You will keep your access to the organization's contents, projects, members, and settings,
          except you won't be able to remove the organization.
        </li>
      </ul>

      <div className="flex w-full gap-2">
        <Button type="button" size="large" block onClick={toggleModalOpen}>
          Cancel
        </Button>
        <Button
          size="large"
          block
          variant="primary"
          disabled={isSubmitting || !isValid || !touched.confirmation || !touched.newOwner}
          onClick={() => handleSubmit()}
        >
          Transfer this organization
        </Button>
      </div>
    </Modal>
  );
};
