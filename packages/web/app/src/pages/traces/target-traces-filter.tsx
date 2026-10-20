import {
  ChangeEventHandler,
  Fragment,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import debounce from 'lodash.debounce';
import { CircleXIcon, PlusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Button } from '@/components/ui/primitives/button/button';
import { Checkbox } from '@/components/ui/primitives/checkbox/checkbox';
import { Collapsible } from '@/components/ui/primitives/collapsible/collapsible';
import { Input } from '@/components/ui/primitives/input/input';
import { Separator } from '@/components/ui/primitives/separator/separator';
import { focusRing } from '@/components/ui/primitives/shared-styles';
import { Slider } from '@/components/ui/primitives/slider/slider';
import { formatNumber } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export function FilterLocalSearch(props: { value: string; onChange(value: string): void }) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    props.onChange(e.target.value);
  }, []);

  return (
    <div className="mt-4 flex w-full max-w-sm items-center space-x-2">
      <Input type="text" placeholder="Search values" value={props.value} onChange={handleChange} />
    </div>
  );
}

/** A row in a filter group. */
const filterRowClass = cn(
  'hover:bg-surface-hover flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-colors',
  focusRing,
);

export const MultiInputFilter = memo(
  (props: {
    name: string;
    /**
     * Filter's key for the backend and url state
     */
    key: string;
    selectedValues: string[];
    onChange(selectedValues: string[]): void;
  }) => {
    const [traceId, setTraceId] = useState('');
    const handleTraceIdChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setTraceId(e.target.value);
      },
      [setTraceId],
    );

    const addTraceId = useCallback(() => {
      if (!traceId) {
        return;
      }

      if (!props.selectedValues.includes(traceId)) {
        props.onChange(props.selectedValues.concat(traceId));
      }

      setTraceId('');
    }, [traceId, setTraceId]);

    return (
      <Filter
        name={props.name}
        changes={props.selectedValues.length}
        onReset={() => props.onChange([])}
      >
        <form
          className="mt-4 flex w-full max-w-sm items-center space-x-2"
          onSubmit={e => {
            e.preventDefault();
            addTraceId();
          }}
        >
          <Input
            type="text"
            placeholder="Trace ID..."
            value={traceId}
            onChange={handleTraceIdChange}
          />
          <Button
            variant="outline"
            layout="iconOnly"
            icon={PlusIcon}
            aria-label="Add trace ID"
            type="submit"
            onClick={() => {
              addTraceId();
            }}
          />
        </form>
        {props.selectedValues.map(value => (
          <MultiInputFilterValue
            key={value}
            value={value}
            onRemove={() => props.onChange(props.selectedValues.filter(val => val !== value))}
          />
        ))}
      </Filter>
    );
  },
);

function MultiInputFilterValue(props: { value: string; onRemove(): void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={props.onRemove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={filterRowClass}
    >
      <Checkbox visual checked indeterminate={hovered} size="sm" />
      {props.value}
    </button>
  );
}

export const MultiSelectFilter = function MultiSelectFilter<$Value>(props: {
  name: string;
  /**
   * Filter's key for the backend and url state
   */
  key: string;
  hideSearch?: boolean;
  options: Array<{
    /**
     * How often it occurs
     */
    count: number;
    /**
     * What to display
     */
    label: ReactNode;
    /**
     * What to use when searching
     */
    searchContent: string;
    /**
     * A value to use when the filter is selected
     */
    value: $Value;
  }>;
  selectedValues: $Value[];
  onChange(selectedValues: $Value[]): void;
}) {
  const [searchPhrase, setSearchPhrase] = useState('');
  const filteredOptions = useMemo(() => {
    const lowerSearchPhrase = searchPhrase.toLowerCase().trim();

    if (!lowerSearchPhrase) {
      return props.options;
    }

    return props.options.filter(option =>
      option.searchContent.toLowerCase().includes(lowerSearchPhrase),
    );
  }, [searchPhrase, props.options]);

  return (
    <Filter
      name={props.name}
      changes={props.selectedValues.length}
      onReset={() => props.onChange([])}
    >
      {!props.hideSearch && props.options.length > 0 && (
        <FilterLocalSearch value={searchPhrase} onChange={setSearchPhrase} />
      )}
      {filteredOptions.length === 0 ? (
        <div className="text-center text-sm text-fg-subtle">No option available</div>
      ) : (
        filteredOptions.map((option, index) => (
          <FilterOption
            key={index}
            selected={props.selectedValues.includes(option.value)}
            count={option.count}
            onClick={() => {
              if (props.selectedValues.includes(option.value)) {
                props.onChange(props.selectedValues.filter(val => val !== option.value));
              } else {
                props.onChange(props.selectedValues.concat(option.value));
              }
            }}
          >
            {option.label === '' ? (
              <span className="text-fg-secondary">{'<unknown>'}</span>
            ) : (
              option.label
            )}
          </FilterOption>
        ))
      )}
    </Filter>
  );
};

export function FilterOption(props: {
  onClick(): void;
  selected: boolean;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button type="button" onClick={props.onClick} className={cn(filterRowClass, 'justify-between')}>
      <div className="flex items-center gap-2 overflow-hidden">
        <Checkbox visual checked={props.selected} size="sm" />
        {props.children}
      </div>
      {props.count ? (
        <Badge
          content={String(formatNumber(props.count))}
          variants={{ variant: 'secondary', size: 'sm', mono: true }}
        />
      ) : null}
    </button>
  );
}

/** One collapsible group of the filter column, with a reset count at its trailing edge. */
export function Filter(props: {
  name: string;
  changes?: number;
  onReset(): void;
  children: ReactNode;
}) {
  return (
    <Fragment key={props.name}>
      <div className="px-2">
        <Collapsible
          trigger={props.name}
          actions={
            props.changes ? (
              <button
                type="button"
                aria-label={`Reset ${props.name} filter`}
                className={cn(
                  'group ml-auto flex h-6 w-8 items-center justify-center rounded-md px-1 text-xs text-fg-secondary transition-colors hover:bg-surface-hover',
                  focusRing,
                )}
                onClick={props.onReset}
              >
                <CircleXIcon className="hidden size-3 group-hover:block" />
                <span className="block group-hover:hidden">{props.changes}</span>
              </button>
            ) : null
          }
        >
          <div className="flex w-full min-w-0 flex-col gap-1 text-sm">{props.children}</div>
        </Collapsible>
      </div>
      <Separator />
    </Fragment>
  );
}

export const DurationFilter = memo(
  (props: { value: [number, number] | []; onChange(value: [number, number]): void }) => {
    const minValue = 0;
    const maxValue = 100_000;
    const defaultValues: [number, number] = [minValue, maxValue];
    const [values, setValues] = useState<[number, number]>(
      props.value.length ? props.value : defaultValues,
    );

    const handleStateChange = useMemo(
      () =>
        debounce((newValues: [number, number]) => {
          props.onChange(newValues);
        }, 1000),
      [props.onChange],
    );

    const handleSliderChange = useCallback(
      (newValues: [number, number]) => {
        handleStateChange(newValues);
        setValues(newValues);
      },
      [handleStateChange, setValues],
    );

    useEffect(() => {
      return () => handleStateChange.cancel();
    }, [handleStateChange]);

    const handleInputChange = useCallback(
      (index: number, value: string) => {
        const numValue = Number.parseInt(value) || minValue;
        const newValues: [number, number] = [...values];
        newValues[index] = Math.min(Math.max(numValue, minValue), maxValue);

        handleStateChange(newValues);
        setValues(newValues);
      },
      [handleStateChange, setValues],
    );

    const handleMinInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
      e => handleInputChange(0, e.target.value),
      [handleInputChange],
    );

    const handleMaxInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
      e => handleInputChange(1, e.target.value),
      [handleInputChange],
    );

    return (
      <Filter
        name="Duration"
        changes={values[0] === minValue && values[1] === maxValue ? 0 : 1}
        onReset={() => props.onChange(defaultValues)}
      >
        <div className="space-y-6 p-2">
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="font-mono text-xs text-fg-secondary">MIN</label>
              <Input
                type="number"
                value={values[0]}
                onChange={handleMinInputChange}
                size="compact"
                mono
                trailing={<span className="font-mono text-xs text-fg-secondary">ms</span>}
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-xs text-fg-secondary">MAX</label>
              <Input
                type="number"
                value={values[1]}
                onChange={handleMaxInputChange}
                size="compact"
                mono
                trailing={<span className="font-mono text-xs text-fg-secondary">ms</span>}
              />
            </div>
          </div>
          <Slider
            max={maxValue}
            min={minValue}
            step={1}
            value={values}
            onValueChange={handleSliderChange}
            aria-label="Duration"
          />
        </div>
      </Filter>
    );
  },
);
