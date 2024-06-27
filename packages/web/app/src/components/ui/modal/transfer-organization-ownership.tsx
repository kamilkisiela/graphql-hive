import { ReactElement, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation, useQuery, UseQueryState } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
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
import { FragmentType, graphql, useFragment } from '@/gql';
import { TransferOrganizationOwnership_MembersQuery } from '@/gql/graphql';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';
import { useToast } from '../use-toast';
import { Check, ChevronsUpDown } from 'lucide-react';
import { FormControl, FormField, FormItem, FormMessage, FormLabel } from '../form';

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
  const router = useRouter();
  const organizationName = query.data?.organization?.organization.name;


  const members = (query.data?.organization?.organization.members.nodes ?? []).filter(
    member => !member.isOwner,
  );
  const [openPopover, setOpenPopover] = useState(false);
  const [valuePopover, setValuePopover] = useState<Option | null | undefined>(null);

  const options = members.map(member => ({
    value: member.id,
    label: member.user.fullName,
  })) as Option[];


  const handleRoute = () => {
    void router.navigate({
      to: '/$organizationId/view/members',
      params: { organizationId: organization.cleanId },
      search: { page: 'list' },
    });
  };

  const formSchema = z.object({
    newOwner: z.string().min(1, 'New owner is not defined'),
    confirmation: z
      .string()
      .min(1)
      .refine(val => val === organizationName, 'Type organization name to confirm'),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: { newOwner: '', confirmation: '' },
  });

  const { toast } = useToast();
  const [, mutate] = useMutation(TransferOrganizationOwnership_Request);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await mutate({
      input: { organization: organization.cleanId, user: values.newOwner },
    });

    if (result.error) {
      toast({
        title: 'Error',
        description: 'Failed to request ownership transfer',
      });
    }

    if (result.data?.requestOrganizationTransfer.ok) {
      toast({
        title: 'Success',
        description: `Ownership transfer request sent to ${result.data.requestOrganizationTransfer.ok.email}`,
      });
      toggleModalOpen();
    }
  }

  return (
    <TransferOrganizationOwnershipModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      openPopover={openPopover}
      setOpenPopover={setOpenPopover}
      valuePopover={valuePopover}
      setValuePopover={setValuePopover}
      options={options}
      handleRoute={handleRoute}
      organization={organization}
      organizationName={organizationName}
      form={form}
      formSchema={formSchema}
      mutate={mutate}
      onSubmit={onSubmit}
    />
  );
};



export const TransferOrganizationOwnershipModalContent = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  openPopover: boolean;
  setOpenPopover: (open: boolean) => void;
  valuePopover?: Option | null | undefined;
  setValuePopover: (value: Option | null | undefined) => void;
  options: Option[];
  handleRoute: () => void;
  organization: { cleanId: string };
  organizationName: string | undefined;
  formSchema: z.ZodObject<{ newOwner: z.ZodString; confirmation: z.ZodString }>;
  form: UseFormReturn<z.infer<typeof formSchema>>;
  mutate: ReturnType<typeof useMutation>[0];
  onSubmit: () => void;
}): ReactElement => {


  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="flex w-[800px] flex-col items-center gap-5">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
        </DialogHeader>
        <DialogDescription className="flex flex-col gap-2">
          Transferring is completed after the new owner approves the transfer.
          <Popover open={props.openPopover} onOpenChange={props.setOpenPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={props.openPopover}
                className="w-full justify-between"
              >
                {props.valuePopover
                  ? props.options.find((option) => option.value === props.valuePopover?.value)?.label
                  : "Select new owner"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput className=' relative w-full' placeholder="Search members" />
                <CommandEmpty
                  className='cursor-pointer'
                  onClick={props.handleRoute}>
                  No members found - Click to route to members page
                </CommandEmpty>
                <CommandGroup>
                  {props.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(currentValue) => {
                        props.setValuePopover(props.options.find((option) => option.value === currentValue))
                        props.setOpenPopover(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          props.valuePopover?.label === option.label ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <FormLabel>
                      Type
                      <span className="font-bold text-white">{props.organization.cleanId}</span>
                      name to confirm
                    </FormLabel>
                    <Input
                      disabled={!props.valuePopover}
                      placeholder="Organization name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            onClick={props.toggleModalOpen}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="w-full justify-center"
            variant="primary"
            disabled={!props.valuePopover}
            onClick={form.handleSubmit(onSubmit)}>
            Transfer this organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
};