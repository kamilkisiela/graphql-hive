import {
  Children,
  cloneElement,
  createContext,
  useContext,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';
import { Label, LabelHint, labelVariants, type LabelHintProps } from '../label/label';
import * as styles from './form.css';

// The three generics mirror useForm's, so a schema that transforms its values (defaults, coercion)
// hands the submit handler the output type, not the input type.
type FormProps<
  TFieldValues extends FieldValues,
  TContext,
  TTransformedValues extends FieldValues,
> = {
  /** The `useForm` result. */
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
  /** Called with the values once they validate. */
  onSubmit: SubmitHandler<TTransformedValues>;
  children: ReactNode;
  /** Test hooks and the like, on the form element; an `id` lets a submit button outside it join. */
  attrs?: Record<string, string>;
};

/**
 * The form: react-hook-form's provider for the parts below, and the element that submits. It owns
 * the space between fields; a row of fields side by side is the page's own wrapper.
 */
export function Form<
  TFieldValues extends FieldValues,
  TContext = any,
  TTransformedValues extends FieldValues = TFieldValues,
>({ form, onSubmit, children, attrs }: FormProps<TFieldValues, TContext, TTransformedValues>) {
  return (
    <FormProvider {...form}>
      <form className={styles.formForm} onSubmit={form.handleSubmit(onSubmit)} {...attrs}>
        {children}
      </form>
    </FormProvider>
  );
}

type FormFieldContextValue = { name: string };
const FormFieldContext = createContext<FormFieldContextValue>({} as FormFieldContextValue);

/** A Controller that tells the parts below which field they belong to. */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

type FormItemContextValue = { id: string; group: boolean };
const FormItemContext = createContext<FormItemContextValue>({} as FormItemContextValue);

function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(fieldContext.name, formState);

  return {
    id: itemContext.id,
    group: itemContext.group,
    name: fieldContext.name,
    formItemId: `${itemContext.id}-form-item`,
    formMessageId: `${itemContext.id}-form-item-message`,
    ...fieldState,
  };
}

/**
 * One field: label, control, message. `group` for a radio group or a selector that is not one
 * input; the item becomes a fieldset and its label the legend, since there is no single control
 * for a label to point at.
 */
export function FormItem({ children, group = false }: { children: ReactNode; group?: boolean }) {
  const id = useId();
  const value = { id, group };
  if (group) {
    return (
      <FormItemContext.Provider value={value}>
        <fieldset className={styles.formItemFieldset}>{children}</fieldset>
      </FormItemContext.Provider>
    );
  }
  return (
    <FormItemContext.Provider value={value}>
      <div className={styles.formItemDiv}>{children}</div>
    </FormItemContext.Provider>
  );
}

type FormLabelProps = LabelHintProps & {
  label: string;
};

/**
 * The field's Label, pointed at the control by the item's id. In a group item it is the fieldset's
 * legend instead, since there is no one control to point at. The tooltip replaces helper text
 * under the control.
 */
export function FormLabel({ label, tooltip, icon }: FormLabelProps) {
  const { formItemId, group } = useFormField();
  if (group) {
    return (
      <legend className={styles.formLabelLegend} data-label>
        <span className={labelVariants({ variant: 'caps' })}>{label}</span>
        <LabelHint tooltip={tooltip} icon={icon} name={label} />
      </legend>
    );
  }
  return <Label htmlFor={formItemId} label={label} tooltip={tooltip} icon={icon} />;
}

/**
 * Wires the one field it wraps to its label and message by cloning it with the ids and the error
 * state. Error styling is the field's own, from `aria-invalid`. Anything the field already sets
 * wins over what is injected here.
 */
export function FormControl({ children }: { children: ReactElement }) {
  const { error, formItemId, formMessageId } = useFormField();
  const child = Children.only(children);
  const injected: Record<string, unknown> = {
    id: formItemId,
    'aria-describedby': error ? formMessageId : undefined,
    'aria-invalid': !!error,
  };
  for (const key of Object.keys(injected)) {
    if (child.props[key] !== undefined) {
      delete injected[key];
    }
  }
  return cloneElement(child, injected);
}

/** The field's error. The line is always there, so a form does not jump when one appears. */
export function FormMessage() {
  const { error, formMessageId } = useFormField();
  return (
    <p id={formMessageId} data-form-message className={styles.formMessageP}>
      {error?.message ? String(error.message) : null}
    </p>
  );
}
