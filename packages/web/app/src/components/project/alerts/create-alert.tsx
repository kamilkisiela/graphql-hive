import { ReactElement } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useMutation } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  AlertType,
  CreateAlertModal_AlertChannelFragmentFragment,
  CreateAlertModal_TargetFragmentFragment,
} from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';

export const CreateAlertModal_AddAlertMutation = graphql(`
  mutation CreateAlertModal_AddAlertMutation($input: AddAlertInput!) {
    addAlert(input: $input) {
      ok {
        updatedProject {
          id
        }
        addedAlert {
          ...AlertsTable_AlertFragment
        }
      }
      error {
        message
      }
    }
  }
`);

export const CreateAlertModal_TargetFragment = graphql(`
  fragment CreateAlertModal_TargetFragment on Target {
    id
    cleanId
    name
  }
`);

export const CreateAlertModal_AlertChannelFragment = graphql(`
  fragment CreateAlertModal_AlertChannelFragment on AlertChannel {
    id
    name
  }
`);

const createAlertModalFormSchema = z.object({
  type: z.enum([AlertType.SchemaChangeNotifications]),
  target: z
    .string({
      required_error: 'Target is required',
    })
    .min(1, 'Must select target'),
  channel: z
    .string({
      required_error: 'Channel is required',
    })
    .min(1, 'Must select channel'),
});

type CreateAlertModalFormValues = z.infer<typeof createAlertModalFormSchema>;

export const CreateAlertModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  targets: FragmentType<typeof CreateAlertModal_TargetFragment>[];
  channels: FragmentType<typeof CreateAlertModal_AlertChannelFragment>[];
  organizationId: string;
  projectId: string;
}): ReactElement => {
  const { isOpen, toggleModalOpen } = props;
  const { toast } = useToast();
  const targets = useFragment(CreateAlertModal_TargetFragment, props.targets);
  const channels = useFragment(CreateAlertModal_AlertChannelFragment, props.channels);
  const [mutation, mutate] = useMutation(CreateAlertModal_AddAlertMutation);

  const form = useForm<CreateAlertModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createAlertModalFormSchema),
    defaultValues: {
      type: AlertType.SchemaChangeNotifications,
      target: '',
      channel: '',
    },
  });

  async function onSubmit(values: CreateAlertModalFormValues) {
    const { error, data } = await mutate({
      input: {
        organization: props.organizationId,
        project: props.projectId,
        target: values.target,
        channel: values.channel,
        type: values.type,
      },
    });

    const errorCombined = error?.message || data?.addAlert.error?.message || mutation.error;

    if (errorCombined) {
      toast({
        title: 'Error',
        description: 'Failed to create alert',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Alert created successfully',
        variant: 'default',
      });
      toggleModalOpen();
      form.reset();
    }
  }

  return (
    <CreateAlertModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      onSubmit={onSubmit}
      form={form}
      channels={channels}
      targets={targets}
    />
  );
};

export function CreateAlertModalContent(props: {
  form: UseFormReturn<z.infer<typeof createAlertModalFormSchema>>;
  onSubmit: (values: CreateAlertModalFormValues) => void;
  isOpen: boolean;
  toggleModalOpen: () => void;
  channels: CreateAlertModal_AlertChannelFragmentFragment[];
  targets: CreateAlertModal_TargetFragmentFragment[];
}) {
  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={() => {
        props.toggleModalOpen();
        props.form.reset();
      }}
    >
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        <Form {...props.form}>
          <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create an alert</DialogTitle>
              <DialogDescription>
                Create an alert to receive notifications when a schema change occurs.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={props.form.control}
                name="type"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={async v => {
                            await field.onChange(v);
                          }}
                        >
                          <SelectTrigger>
                            {field.value === AlertType.SchemaChangeNotifications
                              ? 'Schema Change Notifications'
                              : 'Select alert type'}
                          </SelectTrigger>
                          <SelectContent className="w-[--radix-select-trigger-width]">
                            <SelectItem value={AlertType.SchemaChangeNotifications}>
                              Schema Change Notifications
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={props.form.control}
                name="channel"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Channel</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={async v => {
                            await field.onChange(v);
                          }}
                        >
                          <SelectTrigger>
                            {props.channels.find(channel => channel.id === field.value)?.name ??
                              'Select a Channel'}
                          </SelectTrigger>
                          <SelectContent className="w-[--radix-select-trigger-width]">
                            {props.channels.length === 0 ? (
                              <SelectItem
                                value="No channels available - Please create a channel first"
                                disabled
                              >
                                No channels available - Please create a channel first
                              </SelectItem>
                            ) : (
                              props.channels.map(channel => (
                                <SelectItem key={channel.id} value={channel.id}>
                                  {channel.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={props.form.control}
                name="target"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Target</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={async v => {
                            await field.onChange(v);
                          }}
                        >
                          <SelectTrigger>
                            {props.targets.find(target => target.id === field.value)?.name ??
                              'Select a Target'}
                          </SelectTrigger>
                          <SelectContent className="w-[--radix-select-trigger-width]">
                            {props.targets.length === 0 ? (
                              <SelectItem
                                value="No targets available - Please create a target first"
                                disabled
                              >
                                No targets available - Please create a target first
                              </SelectItem>
                            ) : (
                              props.targets.map(target => (
                                <SelectItem key={target.id} value={target.name}>
                                  {target.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
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
                  props.toggleModalOpen();
                  props.form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                className="w-full justify-center"
                variant="primary"
                disabled={props.form.formState.isSubmitting || !props.form.formState.isValid}
              >
                Create Alert
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
