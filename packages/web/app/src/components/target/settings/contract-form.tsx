import { useId, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/primitives/button/button';
import { Checkbox } from '@/components/ui/primitives/checkbox/checkbox';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { itemVariants } from '@/components/ui/primitives/floating/shared-styles';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/primitives/form/form';
import { Input } from '@/components/ui/primitives/input/input';
import { Label } from '@/components/ui/primitives/label/label';
import { cn } from '@/lib/utils';

/** The dialog footer's submit button lives outside the form and targets it by this id. */
export const CONTRACT_FORM_ID = 'create-contract-form';

export const ContractFormSchema = z.object({
  contractName: z.string().min(1, 'Required'),
  includeTags: z.array(z.string()),
  excludeTags: z.array(z.string()),
  removeUnreachableTypesFromPublicApiSchema: z.boolean(),
});

export type ContractFormValues = z.infer<typeof ContractFormSchema>;

/**
 * The tag list under an include/exclude field: every tag on the latest schema version, with a
 * check on the ones already picked. Rows toggle without closing, and the popover keeps focus in
 * the field, so the list is a picker beside typing rather than a replacement for it.
 */
export function TagSuggestions(props: {
  tags: readonly string[];
  selected: readonly string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div className="w-[200px] p-1">
      <div className="px-2 py-1.5 text-xs font-medium text-fg-secondary">
        Tags from latest schema version
      </div>
      {props.tags.map(value => (
        <button
          key={value}
          type="button"
          onClick={() => props.onToggle(value)}
          className={itemVariants({
            selected: props.selected.includes(value),
            className: 'w-full hover:bg-surface-hover hover:text-fg',
          })}
        >
          <Check
            className={cn(
              'mr-2 size-4',
              props.selected.includes(value) ? 'opacity-100' : 'opacity-0',
            )}
          />
          {value}
        </button>
      ))}
    </div>
  );
}

/**
 * A list of tags built from a field: typed and added by Enter or the button, or toggled from the
 * suggestions that open on focus. The field is the control the form wires, so it takes the id and
 * aria attributes FormControl injects.
 */
function TagsField(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  value: readonly string[];
  onChange: (tags: string[]) => void;
  onBlur?: () => void;
  placeholder: string;
  suggestions: readonly string[];
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  // The field is the anchor rather than a trigger so the Add button beside it does not toggle
  // the suggestions.
  const inputRef = useRef<HTMLInputElement>(null);

  function add(tag: string) {
    if (!tag) {
      return;
    }
    if (!props.value.includes(tag)) {
      props.onChange([...props.value, tag]);
    }
    setDraft('');
  }

  function toggle(tag: string) {
    props.onChange(
      props.value.includes(tag)
        ? props.value.filter(value => value !== tag)
        : [...props.value, tag],
    );
  }

  return (
    <div className="flex">
      <div className="flex-1">
        <div className="flex w-full max-w-sm items-center gap-2">
          <Input
            ref={inputRef}
            id={props.id}
            aria-describedby={props['aria-describedby']}
            aria-invalid={props['aria-invalid']}
            autoComplete="off"
            onSurface="raised"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={props.onBlur}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add(draft);
              }
            }}
            placeholder={props.placeholder}
            disabled={props.disabled}
          />
          <Button
            type="button"
            onSurface="raised"
            onClick={() => add(draft)}
            disabled={props.disabled || draft === ''}
          >
            Add
          </Button>
        </div>
        <Popover
          open={open}
          onOpenChange={setOpen}
          anchor={inputRef}
          align="start"
          initialFocus={false}
          padding="none"
          width="auto"
          content={
            <TagSuggestions tags={props.suggestions} selected={props.value} onToggle={toggle} />
          }
        />
      </div>
      <div className="flex flex-1 flex-wrap gap-1 pl-3">
        {props.value.map(value => (
          <Button
            key={value}
            type="button"
            size="compact"
            onSurface="raised"
            aria-label={`Remove ${value}`}
            onClick={event => {
              props.onChange(props.value.filter(tagValue => tagValue !== value));
              event.stopPropagation();
            }}
          >
            {value}
            <X className="size-3" />
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The body of the create contract dialog. The dialog owns the form state and the mutation. */
export function ContractForm(props: {
  form: UseFormReturn<ContractFormValues>;
  onSubmit: (values: ContractFormValues) => void | Promise<void>;
  /** The tags on the latest schema version, offered under both tag fields. */
  suggestedTags: readonly string[];
}) {
  const { form } = props;
  const pruneId = useId();
  return (
    <Form form={form} onSubmit={props.onSubmit} attrs={{ id: CONTRACT_FORM_ID }}>
      <FormField
        control={form.control}
        name="contractName"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Contract Name" />
            <FormControl>
              <Input placeholder="Contract Name" autoComplete="off" onSurface="raised" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="includeTags"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Included Tags" />
            <FormControl>
              <TagsField
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={field.disabled}
                placeholder="Add included tag"
                suggestions={props.suggestedTags}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="excludeTags"
        render={({ field }) => (
          <FormItem>
            <FormLabel label="Excluded Tags" />
            <FormControl>
              <TagsField
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={field.disabled}
                placeholder="Add excluded tag"
                suggestions={props.suggestedTags}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="removeUnreachableTypesFromPublicApiSchema"
        render={({ field }) => (
          <FormItem group>
            <FormLabel label="Remove unreachable Types" />
            <div className="flex items-center gap-2 pl-1">
              <Checkbox
                id={pruneId}
                checked={field.value}
                onCheckedChange={checked => field.onChange(!!checked)}
                disabled={field.disabled}
              />
              <Label
                htmlFor={pruneId}
                variant="inline"
                label="Remove unreachable types from public API schema"
              />
            </div>
          </FormItem>
        )}
      />
    </Form>
  );
}
