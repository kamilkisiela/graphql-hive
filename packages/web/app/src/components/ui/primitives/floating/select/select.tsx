import { cloneElement, useId, useState, type FocusEvent, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Button } from '../../button/button';
import { type ControlSize, type OnSurface } from '../../shared-styles';
import { useFloatingPortalContainer } from '../floating-portal-container';
import { FloatingSearch } from '../floating-search';
import {
  floatingEmptyState,
  floatingScrollArea,
  floatingVariants,
  itemVariants,
  type FloatingProps,
} from '../shared-styles';
import { Tooltip } from '../tooltip/tooltip';
import * as styles from './select.css';

export type SelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /**
   * A second line under the label. For an option whose name needs qualifying: what a sort order
   * means, what a role grants, why a choice is unavailable. Shown on disabled options too, so the
   * reason a row cannot be picked is visible without hovering.
   */
  description?: ReactNode;
  disabled?: boolean;
  /**
   * Explains the option on hover. Shown for disabled options too, which is the case it exists
   * for: the description says what the option is, the tooltip says why it cannot be picked now.
   */
  tooltip?: ReactNode;
  /** Extra text the search field matches besides the label: an email, a full name, an alias. */
  keywords?: string;
  /**
   * Sits at the row's far end: a status, a count, a shortcut. The leading slot belongs to the
   * selection check, so metadata that would collide with it goes here.
   */
  trailing?: ReactNode;
  'data-cy'?: string;
};

// Select owns its trigger widths. Button only knows `auto | full`, because full-width is the
// only width buttons ask for; the fixed steps here are what select triggers ask for.
const widthClass = {
  auto: styles.widthClassAuto,
  sm: styles.widthClassSm,
  md: styles.widthClassMd,
  lg: styles.widthClassLg,
  full: styles.widthClassFull,
} as const;

type SelectProps = Partial<
  Pick<FloatingProps, 'trigger' | 'side' | 'align' | 'sideOffset' | 'open' | 'onOpenChange'>
> & {
  options: readonly SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  /**
   * Overrides the trigger text, which otherwise echoes the selected option's label. For a trigger
   * that summarises rather than echoes: "Sort by requests", or "Select a service…" on a control
   * that is really an add action and never holds a selection.
   */
  label?: ReactNode;
  disabled?: boolean;
  /** A search field at the top of the popup. For lists long enough to need one. */
  searchable?: boolean;
  /** Placeholder for that search field. Defaults to "Search...". */
  searchPlaceholder?: string;
  /** The surface the trigger sits on. `raised` for a select inside a popover or card. */
  onSurface?: OnSurface;
  /** `compact` for a select that is part of filter chrome, beside chips and date pickers. */
  size?: ControlSize;
  width?: keyof typeof widthClass;
  /**
   * Size the popup to the trigger rather than to its content, so a long option label does not
   * make the panel wider than the control it belongs to.
   */
  matchTriggerWidth?: boolean;
  /**
   * What the select chooses, for assistive tech: "Contract", "Sort by". The trigger is a combobox,
   * a role that takes no name from its text, so without this or a `<label htmlFor>` on `id` the
   * control is announced as nothing at all. Rendered as a hidden label that the trigger is
   * labelled by together with its own text, so the name keeps the current value: "Sort by,
   * Requests" rather than "Sort by" alone.
   */
  'aria-label'?: string;
  /** Lands on the trigger, so a `<label htmlFor>` can point at it. */
  id?: string;
  /** Form field name, for a select inside a native form. */
  name?: string;
  onBlur?: (event: FocusEvent<HTMLButtonElement>) => void;
  /** Test hook on the trigger. */
  'data-cy'?: string;
  /** Test hook on the popup. */
  popupDataCy?: string;
};

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  label,
  trigger,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  disabled,
  open,
  onOpenChange,
  searchable,
  searchPlaceholder,
  onSurface,
  size,
  width = 'auto',
  matchTriggerWidth,
  'aria-label': ariaLabel,
  id,
  name,
  onBlur,
  'data-cy': dataCy,
  popupDataCy,
}: SelectProps) {
  const selectedLabel = options.find(o => o.value === value)?.label;
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const labelId = `${triggerId}-label`;
  const [search, setSearch] = useState('');
  const portalContainer = useFloatingPortalContainer();

  const normalizedSearch = search.toLowerCase();
  const displayedOptions =
    searchable && search
      ? options.filter(
          o =>
            o.value === '' ||
            o.label.toLowerCase().includes(normalizedSearch) ||
            o.keywords?.toLowerCase().includes(normalizedSearch),
        )
      : options;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSearch('');
    onOpenChange?.(nextOpen);
  };

  return (
    <div className={widthClass[width]}>
      {ariaLabel ? (
        <span id={labelId} className={styles.selectSpan}>
          {ariaLabel}
        </span>
      ) : null}
      <BaseSelect.Root
        value={value}
        onValueChange={val => {
          if (val != null && onValueChange) {
            onValueChange(val);
          }
        }}
        open={open}
        onOpenChange={handleOpenChange}
        disabled={disabled}
        name={name}
      >
        <BaseSelect.Trigger
          // Named on the Trigger so a custom `trigger` gets it too; the id has to sit on the
          // rendered element itself, since the Trigger does not pass one through.
          aria-labelledby={ariaLabel ? `${labelId} ${triggerId}` : undefined}
          render={
            typeof trigger === 'function' ? (
              (props: unknown, state: unknown) =>
                trigger({ ...(props as object), id: triggerId }, state)
            ) : trigger ? (
              cloneElement(trigger, { id: triggerId })
            ) : (
              <Button
                label={label ?? selectedLabel ?? placeholder}
                rightIcon={{ icon: ChevronDown, withSeparator: true }}
                disabled={disabled}
                onSurface={onSurface}
                size={size}
                width={width === 'auto' ? 'auto' : 'full'}
                id={triggerId}
                onBlur={onBlur}
                data-cy={dataCy}
              />
            )
          }
        />

        <BaseSelect.Portal container={portalContainer ?? undefined}>
          <BaseSelect.Positioner
            side={side}
            align={align}
            sideOffset={sideOffset}
            alignItemWithTrigger={false}
            className={styles.selectPositioner}
          >
            <BaseSelect.Popup
              className={clsx(
                floatingVariants({ padding: 'sm' }),
                matchTriggerWidth ? styles.selectPopup : undefined,
              )}
              data-cy={popupDataCy}
            >
              {searchable && (
                <FloatingSearch
                  label="options"
                  onSearch={setSearch}
                  value={search}
                  placeholder={searchPlaceholder}
                />
              )}
              <div className={searchable ? `${floatingScrollArea} ${styles.selectDiv}` : ''}>
                {displayedOptions.length === 0 ? (
                  <div className={floatingEmptyState}>No matches</div>
                ) : (
                  displayedOptions.map(option => {
                    const item = (
                      <BaseSelect.Item
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        data-cy={option['data-cy']}
                        className={state =>
                          clsx(
                            itemVariants({
                              highlighted: state.highlighted,
                              selected: state.selected,
                              disabled: state.disabled,
                            }),
                            option.description ? styles.selectClass : styles.selectClass2,
                          )
                        }
                      >
                        <BaseSelect.ItemIndicator className={styles.selectItemIndicator}>
                          <Check className={styles.selectCheck} />
                        </BaseSelect.ItemIndicator>
                        <BaseSelect.ItemText>
                          <span className={styles.selectSpan2}>
                            {option.icon}
                            {option.label}
                          </span>
                          {option.description ? (
                            <span className={styles.selectSpan3}>{option.description}</span>
                          ) : null}
                        </BaseSelect.ItemText>
                        {option.trailing ? (
                          <span className={styles.selectSpan4}>{option.trailing}</span>
                        ) : null}
                      </BaseSelect.Item>
                    );
                    // Same wrap as a Menu row: a disabled item has pointer-events-none, so the
                    // tooltip's trigger has to be an element around it.
                    return option.tooltip ? (
                      <Tooltip
                        key={option.value}
                        trigger={<span className={styles.selectSpan5}>{item}</span>}
                        content={option.tooltip}
                        side="right"
                      />
                    ) : (
                      item
                    );
                  })
                )}
              </div>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    </div>
  );
}
