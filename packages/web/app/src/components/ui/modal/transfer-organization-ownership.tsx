import { ReactElement, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
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
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form';
import { useToast } from '../use-toast';

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

const formSchema = z.object({
  newOwner: z.string().min(1, 'New owner is not defined'),
  confirmation: z.string().min(1, 'Organization name is not defined'),
});

type Option = {
  value: string;
  label: string;
};

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
  const organizationCleanId = orgFragment.cleanId;
  const router = useRouter();

  const members = (query.data?.organization?.organization.members.nodes ?? []).filter(
    member => !member.isOwner,
  ) as MemberFromFragment[];

  const handleRoute = () => {
    void router.navigate({
      to: '/$organizationId/view/members',
      params: { organizationId: organizationCleanId },
      search: { page: 'list' },
    });
  };

  const form = useForm<z.infer<typeof formSchema>>({
    mode: 'onChange',
    resolver: zodResolver(formSchema),
    defaultValues: { newOwner: '', confirmation: '' },
  });

  const { toast } = useToast();
  const [, mutate] = useMutation(TransferOrganizationOwnership_Request);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await mutate({
      input: { organization: organizationCleanId, user: values.newOwner },
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
    <>
      <TransferOrganizationOwnershipContent
        form={form}
        isOpen={isOpen}
        onSubmit={() => onSubmit(form.getValues())}
        organizationCleanId={organizationCleanId}
        toggleModalOpen={toggleModalOpen}
        members={members}
        handleRoute={handleRoute}
      />
    </>
  );
};

export const TransferOrganizationOwnershipContent = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  onSubmit: () => void;
  form: UseFormReturn<z.infer<typeof formSchema>>;
  members: MemberFromFragment[];
  organizationCleanId: string;
  handleRoute: () => void;
}): ReactElement => {
  const [openPopover, setOpenPopover] = useState(false);
  const [valuePopover, setValuePopover] = useState<Option | null | undefined>(null);

  const options = props.members.map(member => ({
    value: member.id,
    label: member.user.fullName,
  })) as Option[];

  // Did this way to avoid using formSchema inside the component scope
  const newOwner = props.form.watch('newOwner');
  const orgIdMatchToNewOwner = newOwner === props.organizationCleanId;

  return (
    <Form {...props.form}>
      <form className="bg-black" onSubmit={props.form.handleSubmit(props.onSubmit)}>
        <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
          <DialogContent className="flex w-[800px] flex-col items-center gap-5">
            <DialogHeader>
              <DialogTitle>Transfer Ownership</DialogTitle>
              <DialogDescription>
                Transferring is completed after the new owner approves the transfer.
                <Popover open={openPopover} onOpenChange={setOpenPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openPopover}
                      className="w-full justify-between"
                    >
                      {valuePopover
                        ? options.find(option => option.value === valuePopover?.value)?.label
                        : 'Select new owner'}
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    {options.length > 0 ? (
                      <Command>
                        <CommandInput className="relative w-[410px]" placeholder="Search members" />
                        <CommandEmpty
                          className="cursor-pointer"
                          onClick={() => console.log('handleRoute')}
                        >
                          No members found - Click to route to members page
                        </CommandEmpty>
                        <CommandGroup>
                          {options.map(option => (
                            <CommandItem
                              key={option.value}
                              value={option.value}
                              onSelect={currentValue => {
                                setValuePopover(
                                  options.find(option => option.value === currentValue),
                                );
                                setOpenPopover(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  valuePopover?.label === option.label
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    ) : (
                      <Command className="w-[460px]">
                        <CommandItem className="cursor-pointer" onClick={props.handleRoute}>
                          No members found - Click to route to members page to add new members -&gt;
                        </CommandItem>
                      </Command>
                    )}
                  </PopoverContent>
                </Popover>
              </DialogDescription>
            </DialogHeader>
            <div className="w-full space-y-8">
              <FormField
                disabled={options.length === 0}
                control={props.form.control}
                rules={{
                  validate: value => {
                    if (value !== props.organizationCleanId) {
                      return 'Organization name is not correct';
                    }
                    return true;
                  },
                }}
                name="newOwner"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel className="text-gray-500">
                      Type <span className="font-bold text-white">{props.organizationCleanId}</span>{' '}
                      to confirm.
                    </FormLabel>
                    <FormControl className="w-full">
                      <Input className="w-full" placeholder="New owner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogHeader>
              <DialogTitle>About the ownership transfer</DialogTitle>
              <DialogDescription>
                <ul className="list-disc px-2 text-sm text-white">
                  <li className="pt-5">
                    The new owner will receive a confirmation email. If the new owner doesn't accept
                    the transfer within 24 hours, the invitation will expire.
                  </li>
                  <li className="pt-5">
                    When you transfer an organization to one of the members, the new owner will get
                    access to organization's contents, projects, members, and settings.
                  </li>
                  <li className="pt-5">
                    You will keep your access to the organization's contents, projects, members, and
                    settings, except you won't be able to remove the organization.
                  </li>
                </ul>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex w-full justify-between">
              <Button
                type="button"
                size="lg"
                className="w-full justify-center"
                onClick={props.toggleModalOpen}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                className="w-full justify-center"
                variant="primary"
                disabled={!orgIdMatchToNewOwner || !valuePopover}
              >
                Transfer this organization
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </Form>
  );
};
