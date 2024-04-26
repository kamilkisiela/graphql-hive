import { useEffect, useRef, useState } from 'react';
import { endOfDay, endOfToday, subMonths } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { DateRange, Matcher } from 'react-day-picker';
import { DurationUnit, formatDateToString, parse, units } from '@/lib/date-math';
import { useResetState } from '@/lib/hooks/use-reset-state';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Cross1Icon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';
import { Button } from './button';
import { Calendar } from './calendar';
import { Input } from './input';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface DateRangePickerProps {
  presets?: Preset[];
  /** the active selected/custom preset */
  selectedRange?: { from: string; to: string } | null;
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { preset: Preset }) => void;
  /** Alignment of popover */
  align?: 'start' | 'center' | 'end';
  /** Option for locale */
  locale?: string;
  /** Date after which a range can be picked. */
  startDate?: Date;
  /** valid units allowed */
  validUnits?: DurationUnit[];
}

const formatDate = (date: Date, locale = 'en-us'): string => {
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
};

interface ResolvedDateRange {
  from: Date;
  to: Date;
}

export type Preset = {
  name: string;
  label: string;
  range: { from: string; to: string };
};

export function buildDateRangeString(range: ResolvedDateRange, locale = 'en-us'): string {
  return `${formatDate(range.from, locale)} - ${formatDate(range.to, locale)}`;
}

function resolveRange(rawFrom: string, rawTo: string): ResolvedDateRange | null {
  const from = parse(rawFrom);
  const to = parse(rawTo);

  if (from && to) {
    return { from, to };
  }
  return null;
}

export const presetLast7Days: Preset = {
  name: 'last7d',
  label: 'Last 7 days',
  range: { from: 'now-7d', to: 'now' },
};

export const presetLast1Day: Preset = {
  name: 'last24h',
  label: 'Last 24 hours',
  range: { from: 'now-1d', to: 'now' },
};

// Define presets
export const availablePresets: Preset[] = [
  { name: 'last5min', label: 'Last 5 minutes', range: { from: 'now-5m', to: 'now' } },
  { name: 'last10min', label: 'Last 10 minutes', range: { from: 'now-10m', to: 'now' } },
  { name: 'last15min', label: 'Last 15 minutes', range: { from: 'now-15m', to: 'now' } },
  { name: 'last30min', label: 'Last 30 minutes', range: { from: 'now-30m', to: 'now' } },
  { name: 'last1h', label: 'Last 1 hour', range: { from: 'now-1h', to: 'now' } },
  { name: 'last3h', label: 'Last 3 hours', range: { from: 'now-3h', to: 'now' } },
  { name: 'last6h', label: 'Last 6 hours', range: { from: 'now-6h', to: 'now' } },
  { name: 'last12h', label: 'Last 12 hours', range: { from: 'now-12h', to: 'now' } },
  presetLast1Day,
  { name: 'last2d', label: 'Last 2 days', range: { from: 'now-2d', to: 'now' } },
  { name: 'last3d', label: 'Last 3 days', range: { from: 'now-3d', to: 'now' } },
  presetLast7Days,
  { name: 'last14d', label: 'Last 14 days', range: { from: 'now-14d', to: 'now' } },
  { name: 'last30d', label: 'Last 30 days', range: { from: 'now-30d', to: 'now' } },
  { name: 'last60d', label: 'Last 60 days', range: { from: 'now-60d', to: 'now' } },
  { name: 'last90d', label: 'Last 90 days', range: { from: 'now-90d', to: 'now' } },
  { name: 'last6M', label: 'Last 6 months', range: { from: 'now-6M', to: 'now' } },
  { name: 'last1y', label: 'Last 1 year', range: { from: 'now-364d', to: 'now' } },
];

function findMatchingPreset(range: Preset['range']): Preset | undefined {
  return availablePresets.find(preset => {
    return preset.range.from === range.from && preset.range.to === range.to;
  });
}

/** The DateRangePicker component allows a user to select a range of dates */
export function DateRangePicker(props: DateRangePickerProps): JSX.Element {
  const validUnits = props.validUnits ?? units;
  const disallowedUnits = units.filter(unit => !validUnits.includes(unit));
  const hasInvalidUnitRegex = disallowedUnits?.length
    ? new RegExp(`[0-9]+(${disallowedUnits.join('|')})`)
    : null;

  let presets = props.presets ?? availablePresets;

  if (hasInvalidUnitRegex) {
    presets = presets.filter(
      preset =>
        !hasInvalidUnitRegex.test(preset.range.from) && !hasInvalidUnitRegex.test(preset.range.to),
    );
  }

  const disabledDays: Matcher[] = [
    {
      after: endOfToday(),
    },
  ];

  if (props.startDate) {
    disabledDays.push({
      before: props.startDate,
    });
  }

  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  function getInitialPreset() {
    let preset: Preset | undefined;
    if (
      props.selectedRange &&
      !hasInvalidUnitRegex?.test(props.selectedRange.from) &&
      !hasInvalidUnitRegex?.test(props.selectedRange.to)
    ) {
      preset = findMatchingPreset(props.selectedRange);

      if (preset) {
        return preset;
      }

      const resolvedRange = resolveRange(props.selectedRange.from, props.selectedRange.to);
      if (resolvedRange) {
        return {
          name: `${props.selectedRange.from}_${props.selectedRange.to}`,
          label: buildDateRangeString(resolvedRange),
          range: props.selectedRange,
        };
      }
    }

    return presets.at(0) ?? null;
  }

  const [activePreset, setActivePreset] = useResetState<Preset | null>(getInitialPreset, [
    props.selectedRange,
  ]);
  const [fromValue, setFromValue] = useState(activePreset?.range.from ?? '');
  const [toValue, setToValue] = useState(activePreset?.range.to ?? '');
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [quickRangeFilter, setQuickRangeFilter] = useState('');

  const fromParsed = parse(fromValue);
  const toParsed = parse(toValue);

  const lastPreset = useRef<Preset | null>(activePreset);

  useEffect(() => {
    if (!activePreset || !props.onUpdate) {
      return;
    }

    const fromParsed = parse(activePreset.range.from);
    const toParsed = parse(activePreset.range.to);

    if (fromParsed && toParsed) {
      const resolvedRange = resolveRange(fromValue, toValue);
      if (resolvedRange && lastPreset.current?.name !== activePreset.name) {
        props.onUpdate({
          preset: activePreset,
        });
      }
    }
  }, [activePreset]);

  useEffect(() => {
    lastPreset.current = activePreset;
  }, [activePreset]);

  const resetValues = (): void => {
    setActivePreset(getInitialPreset());
  };

  const PresetButton = ({ preset }: { preset: Preset }): JSX.Element => {
    let isDisabled = false;

    if (props.startDate) {
      const from = parse(preset.range.from);
      if (from && from.getTime() < props.startDate.getTime()) {
        isDisabled = true;
      }
    }

    return (
      <Button
        variant="ghost"
        onClick={() => {
          setActivePreset(preset);
          setFromValue(preset.range.from);
          setToValue(preset.range.to);
          setRange(undefined);
          setShowCalendar(false);
          setIsOpen(false);
          setQuickRangeFilter('');
        }}
        disabled={isDisabled}
        className="w-full justify-start text-left"
      >
        {preset.label}
      </Button>
    );
  };

  const [dynamicPresets, setDynamicPresets] = useState<Preset[]>([]);
  useEffect(() => {
    const number = parseInt(quickRangeFilter.replace(/\D/g, ''));
    const dynamicPresets: Preset[] = [
      {
        name: `last${number}m`,
        label: `Last ${number} minutes`,
        range: { from: `now-${number}m`, to: 'now' },
      },
      {
        name: `last${number}h`,
        label: `Last ${number} hours`,
        range: { from: `now-${number}h`, to: 'now' },
      },
      {
        name: `last${number}d`,
        label: `Last ${number} days`,
        range: { from: `now-${number}d`, to: 'now' },
      },
      {
        name: `last${number}w`,
        label: `Last ${number} weeks`,
        range: { from: `now-${number}w`, to: 'now' },
      },
    ];
    const uniqueDynamicPresets = dynamicPresets.filter(
      preset => !presets.some(p => p.name === preset.name),
    );
    const validDynamicPresets = uniqueDynamicPresets.filter(
      preset =>
        !hasInvalidUnitRegex?.test(preset.range.from) &&
        !hasInvalidUnitRegex?.test(preset.range.to),
    );

    if (number > 0 && validDynamicPresets.length > 0) {
      setDynamicPresets(validDynamicPresets);
    } else {
      setDynamicPresets([]);
    }
  }, [quickRangeFilter, validUnits]);

  presets = [...presets, ...dynamicPresets];

  return (
    <Popover
      modal
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          resetValues();
        }
        setIsOpen(open);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline">
          {activePreset?.label}
          <div className="-mr-2 scale-125 pl-1 opacity-60">
            {isOpen ? <ChevronUpIcon width={24} /> : <ChevronDownIcon width={24} />}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={props.align} className="mt-1 flex h-[380px] w-auto p-0">
        <div className="flex flex-col py-4">
          <div className="flex flex-col items-center justify-end gap-2 lg:flex-row lg:items-start">
            <div className="flex flex-col gap-1 pl-3">
              <div className="mb-2 font-bold">Absolute time range</div>
              <div className="space-y-2">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="from">From</Label>
                  <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input
                      type="text"
                      id="from"
                      value={fromValue}
                      onChange={ev => {
                        setFromValue(ev.target.value);
                      }}
                    />
                    <Button size="icon" variant="ghost" onClick={() => setShowCalendar(true)}>
                      <CalendarDays className="size-4" />
                    </Button>
                  </div>
                  <div className="text-red-500">
                    {hasInvalidUnitRegex?.test(fromValue) ? (
                      <>Only allowed units are {validUnits.join(', ')}</>
                    ) : !fromParsed ? (
                      <>Invalid date string</>
                    ) : null}
                  </div>
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="to">To</Label>
                  <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input
                      type="text"
                      id="to"
                      value={toValue}
                      onChange={ev => {
                        setToValue(ev.target.value);
                      }}
                    />
                    <Button size="icon" variant="ghost" onClick={() => setShowCalendar(true)}>
                      <CalendarDays className="size-4" />
                    </Button>
                  </div>
                  <div className="text-red-500">
                    {hasInvalidUnitRegex?.test(toValue) ? (
                      <>Only allowed units are {validUnits.join(', ')}</>
                    ) : !toParsed ? (
                      <>Invalid date string</>
                    ) : fromParsed && toParsed && fromParsed.getTime() > toParsed.getTime() ? (
                      <div className="text-red-500">To cannot be before from.</div>
                    ) : null}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    const fromWithoutWhitespace = fromValue.trim();
                    const toWithoutWhitespace = toValue.trim();
                    const resolvedRange = resolveRange(fromValue, toValue);
                    if (resolvedRange) {
                      setActivePreset(
                        () =>
                          findMatchingPreset({
                            from: fromWithoutWhitespace,
                            to: toWithoutWhitespace,
                          }) ?? {
                            name: `${fromWithoutWhitespace}_${toWithoutWhitespace}`,
                            label: buildDateRangeString(resolvedRange),
                            range: { from: fromWithoutWhitespace, to: toWithoutWhitespace },
                          },
                      );
                      setIsOpen(false);
                      setShowCalendar(false);
                      setQuickRangeFilter('');
                    }
                  }}
                  disabled={
                    !toParsed ||
                    !fromParsed ||
                    (activePreset?.range.from === fromValue.trim() &&
                      activePreset.range.to === toValue.trim())
                  }
                >
                  Apply date range
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="ml-3 flex flex-col gap-1 border-l py-2 pl-3 pr-2">
          <div className="relative flex items-center">
            <MagnifyingGlassIcon className="absolute left-2" />
            <Input
              placeholder="Filter quick ranges"
              className="w-full pl-7"
              value={quickRangeFilter}
              onChange={ev => setQuickRangeFilter(ev.target.value)}
            />
          </div>
          <div className="flex w-full flex-1 flex-col items-start gap-1 overflow-y-scroll pb-2 pt-1">
            {presets
              .filter(preset =>
                preset.label.toLowerCase().includes(quickRangeFilter.toLowerCase().trim()),
              )
              .map(preset => (
                <PresetButton key={preset.name} preset={preset} />
              ))}
          </div>
        </div>
        {showCalendar && (
          <div className="absolute left-0 top-0  -translate-x-full">
            <div className="bg-popover mr-1 rounded-md border p-4">
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1 rounded-sm bg-transparent opacity-70 transition-opacity hover:bg-transparent hover:opacity-100 focus:outline-none"
                onClick={() => setShowCalendar(false)}
              >
                <Cross1Icon className="size-2" />
              </Button>
              <Calendar
                id="selectedRange"
                mode="range"
                defaultMonth={subMonths(new Date(), 1)}
                numberOfMonths={2}
                selected={range}
                onSelect={range => {
                  if (range?.from && range.to) {
                    setFromValue(formatDateToString(range.from));
                    setToValue(formatDateToString(endOfDay(range.to)));
                  }
                  setRange(range);
                }}
                disabled={disabledDays}
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
