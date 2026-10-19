import { useMemo, useRef, useState } from 'react';
import { endOfDay, endOfToday, formatDate, subMonths } from 'date-fns';
import { CalendarDays, ChevronDown, SearchIcon, X } from 'lucide-react';
import { DateRange, Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/primitives/button/button';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { Input } from '@/components/ui/primitives/input/input';
import { Label } from '@/components/ui/primitives/label/label';
import { ScrollArea } from '@/components/ui/primitives/scroll-area/scroll-area';
import { type ControlSize } from '@/components/ui/primitives/shared-styles';
import { formatDateToString, parse } from '@/lib/date-math';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { UTCDate } from '@date-fns/utc';
import { Calendar } from './calendar';
import * as styles from './date-range-picker.css';

export interface DateRangePickerProps {
  presets?: Preset[];
  /** the active selected/custom preset */
  selectedRange?: { from: string; to: string } | null;
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { preset: Preset }) => void;
  /** Alignment of popover */
  align?: 'start' | 'center' | 'end';
  /** Side of the trigger to place the popover content */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Option for locale */
  locale?: string;
  /** Date after which a range can be picked. */
  startDate?: Date;
  /** Height of the default trigger: `compact` in a filter row, `default` beside form controls. */
  size?: ControlSize;
  /** Custom trigger element. Must forward ref. Replaces the default segmented Button trigger. */
  trigger?: React.ReactElement;
  /** Shown under the custom range, for a note about what can be picked. */
  footer?: React.ReactNode;
}

export interface DateRangePickerPanelProps {
  presets?: Preset[];
  /** the active selected/custom preset */
  selectedRange?: { from: string; to: string } | null;
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { preset: Preset }) => void;
  /** Date after which a range can be picked. */
  startDate?: Date;
  /** Called when a selection is made. Parent should close the container (popover, submenu, etc). */
  onClose?: () => void;
  /** Shown under the custom range, for a note about what can be picked. */
  footer?: React.ReactNode;
}

interface ResolvedDateRange {
  from: Date;
  to: Date;
}

export type Preset = {
  name: string;
  label: string;
  range: { from: string; to: string };
};

export function buildDateRangeString(range: ResolvedDateRange): string {
  const fromDate = formatDate(range.from, 'MMM d');
  const fromTime = formatDate(range.from, 'HH:mm');
  const toDate = formatDate(range.to, 'MMM d');
  const toTime = formatDate(range.to, 'HH:mm');

  if (fromDate === toDate) {
    return `${fromDate}, ${fromTime} - ${toTime}`;
  }

  return `${fromDate}, ${fromTime} - ${toDate}, ${toTime}`;
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
  { name: 'last15m', label: 'Last 15 minutes', range: { from: 'now-15m', to: 'now' } },
  { name: 'last30m', label: 'Last 30 minutes', range: { from: 'now-30m', to: 'now' } },
  { name: 'last1h', label: 'Last 1 hour', range: { from: 'now-1h', to: 'now' } },
  { name: 'last3h', label: 'Last 3 hours', range: { from: 'now-3h', to: 'now' } },
  { name: 'last6h', label: 'Last 6 hours', range: { from: 'now-6h', to: 'now' } },
  { name: 'last12h', label: 'Last 12 hours', range: { from: 'now-12h', to: 'now' } },
  presetLast1Day,
  presetLast7Days,
  { name: 'last14d', label: 'Last 14 days', range: { from: 'now-14d', to: 'now' } },
  { name: 'last30d', label: 'Last 30 days', range: { from: 'now-30d', to: 'now' } },
  { name: 'last90d', label: 'Last 90 days', range: { from: 'now-90d', to: 'now' } },
  { name: 'last6M', label: 'Last 6 months', range: { from: 'now-6M', to: 'now' } },
  { name: 'last1y', label: 'Last 1 year', range: { from: 'now-364d', to: 'now' } },
];

function createQuickRangePresets(number: number): Preset[] {
  return [
    {
      name: `last${number}min`,
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
    {
      name: `last${number}M`,
      label: `Last ${number} months`,
      range: { from: `now-${number}M`, to: 'now' },
    },
    {
      name: `last${number}y`,
      label: `Last ${number} years`,
      range: { from: `now-${number}y`, to: 'now' },
    },
  ];
}

export function findMatchingPreset(
  range: Preset['range'],
  availablePresets: Preset[],
): Preset | undefined {
  return availablePresets.find(preset => {
    return preset.range.from === range.from && preset.range.to === range.to;
  });
}

export function getDateRangeDisplayLabel(
  selectedRange: { from: string; to: string } | null | undefined,
  presets: Preset[],
): string {
  if (!selectedRange) {
    return presets.at(0)?.label ?? 'Select range';
  }

  const staticMatch = findMatchingPreset(selectedRange, presets);
  if (staticMatch) return staticMatch.label;

  if (selectedRange.from.startsWith('now-')) {
    const number = parseInt(selectedRange.from.replace(/\D/g, ''), 10);
    if (!Number.isNaN(number)) {
      const dynamicMatch = findMatchingPreset(selectedRange, createQuickRangePresets(number));
      if (dynamicMatch) return dynamicMatch.label;
    }
  }

  const resolved = resolveRange(selectedRange.from, selectedRange.to);
  if (resolved) return buildDateRangeString(resolved);

  return presets.at(0)?.label ?? 'Select range';
}

/**
 * The standalone date range picker panel containing all picker UI and state.
 * Can be rendered inside a Popover, a menu submenu, or any other container.
 */
export function DateRangePickerPanel(props: DateRangePickerPanelProps) {
  const staticPresets = props.presets ?? availablePresets;

  const disabledDays: Matcher[] = [
    {
      after: endOfToday(),
    },
  ];

  if (props.startDate) {
    // The boundary is a UTC day; the calendar counts local days.
    const day = props.startDate;
    disabledDays.push({
      before: new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    });
  }

  const calendarAnchor = useRef<HTMLDivElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  function getInitialPreset() {
    const fallbackPreset = staticPresets.at(0) ?? null;

    if (!props.selectedRange) {
      return fallbackPreset;
    }

    // Attempt to find preset from out pre-defined presets first
    const preset = findMatchingPreset(props.selectedRange, staticPresets);

    if (preset) {
      return preset;
    }

    // attempt to find the preset based on dynamic presets (so we show something like "last x days" instead of 10. September - 12.September for `now-2d`)
    if (props.selectedRange.from.startsWith('now-')) {
      const number = parseInt(props.selectedRange.from.replace(/\D/g, ''), 10);
      if (!Number.isNaN(number)) {
        const quickRangPresets = createQuickRangePresets(number);

        const preset = quickRangPresets.find(
          preset =>
            preset.range.from === props.selectedRange?.from &&
            preset.range.to === props.selectedRange.to,
        );

        if (preset) {
          return preset;
        }
      }
    }

    // if everything else fails we show an absolute range!

    const resolvedRange = resolveRange(props.selectedRange.from, props.selectedRange.to);
    if (resolvedRange) {
      return {
        name: `${props.selectedRange.from}_${props.selectedRange.to}`,
        label: buildDateRangeString(resolvedRange),
        range: props.selectedRange,
      };
    }

    return fallbackPreset;
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
  // Typed values parse as UTC, so the boundary shows as a UTC date too.
  const fromError = !fromParsed
    ? 'Invalid date string'
    : props.startDate && fromParsed.getTime() < props.startDate.getTime()
      ? `Must start on or after ${formatDateToString(new UTCDate(props.startDate))}`
      : null;
  const toError = !toParsed
    ? 'Invalid date string'
    : fromParsed && fromParsed.getTime() > toParsed.getTime()
      ? 'The end must come after the start.'
      : null;

  const PresetButton = useMemo(
    () =>
      function PresetButton({ preset }: { preset: Preset }): React.ReactNode {
        let isDisabled = false;

        if (props.startDate) {
          const from = parse(preset.range.from);
          const time = from?.getTime();
          const startTime = props.startDate?.getTime();

          if (
            !time ||
            !startTime ||
            Number.isNaN(time) ||
            Number.isNaN(startTime) ||
            time < props.startDate.getTime()
          ) {
            isDisabled = true;
          }
        }

        return (
          <Button
            variant="ghost"
            size="compact"
            width="full"
            label={preset.label}
            onClick={() => {
              setActivePreset(preset);
              setFromValue(preset.range.from);
              setToValue(preset.range.to);
              setRange(undefined);
              setShowCalendar(false);
              setQuickRangeFilter('');
              props.onUpdate?.({ preset });
              props.onClose?.();
            }}
            disabled={isDisabled}
          />
        );
      },
    [props.startDate, props.onClose],
  );

  const dynamicPresets = useMemo(() => {
    const number = parseInt(quickRangeFilter.replace(/\D/g, ''), 10);

    const dynamicPresets = createQuickRangePresets(number).filter(
      preset => !staticPresets.some(p => p.name === preset.name),
    );

    return number > 0 ? dynamicPresets : [];
  }, [quickRangeFilter, staticPresets]);

  return (
    <div className={styles.dateRangePickerPanelDiv}>
      <div ref={calendarAnchor} className={styles.dateRangePickerPanelDiv2}>
        <div className={styles.dateRangePickerPanelDiv3}>
          <div className={styles.dateRangePickerPanelDiv4}>
            <div className={styles.dateRangePickerPanelDiv5}>Absolute date range</div>
            <div className={styles.dateRangePickerPanelDiv6}>
              <div className={styles.dateRangePickerPanelDiv7}>
                <Label htmlFor="from" label="From" />
                <div className={styles.dateRangePickerPanelDiv8}>
                  <Input
                    type="text"
                    id="from"
                    autoComplete="off"
                    value={fromValue}
                    onChange={ev => {
                      setFromValue(ev.target.value);
                    }}
                    mono
                    trailing={
                      <Button
                        layout="iconOnly"
                        icon={CalendarDays}
                        aria-label="Pick a date"
                        variant="ghost"
                        size="compact"
                        onClick={() => setShowCalendar(true)}
                      />
                    }
                  />
                </div>
                <div className={styles.dateRangePickerPanelDiv9}>{fromError}</div>
              </div>
              <div className={styles.dateRangePickerPanelDiv10}>
                <Label htmlFor="to" label="To" />
                <div className={styles.dateRangePickerPanelDiv11}>
                  <Input
                    type="text"
                    id="to"
                    autoComplete="off"
                    value={toValue}
                    onChange={ev => {
                      setToValue(ev.target.value);
                    }}
                    mono
                    trailing={
                      <Button
                        layout="iconOnly"
                        icon={CalendarDays}
                        aria-label="Pick a date"
                        variant="ghost"
                        size="compact"
                        onClick={() => setShowCalendar(true)}
                      />
                    }
                  />
                </div>
                <div className={styles.dateRangePickerPanelDiv12}>{toError}</div>
              </div>

              <Button
                variant="primary"
                width="full"
                onClick={() => {
                  const fromWithoutWhitespace = fromValue.trim();
                  const toWithoutWhitespace = toValue.trim();
                  const resolvedRange = resolveRange(fromValue, toValue);
                  if (resolvedRange) {
                    const preset = findMatchingPreset(
                      {
                        from: fromWithoutWhitespace,
                        to: toWithoutWhitespace,
                      },
                      availablePresets,
                    ) ?? {
                      name: `${fromWithoutWhitespace}_${toWithoutWhitespace}`,
                      label: buildDateRangeString(resolvedRange),
                      range: { from: fromWithoutWhitespace, to: toWithoutWhitespace },
                    };
                    setActivePreset(preset);
                    setShowCalendar(false);
                    setQuickRangeFilter('');
                    props.onUpdate?.({ preset });
                    props.onClose?.();
                  }
                }}
                disabled={
                  !!fromError ||
                  !!toError ||
                  (activePreset?.range.from === fromValue.trim() &&
                    activePreset.range.to === toValue.trim())
                }
              >
                Apply date range
              </Button>
            </div>
          </div>
        </div>
        {props.footer ? (
          <div className={styles.dateRangePickerPanelDiv13}>{props.footer}</div>
        ) : null}
      </div>
      <Popover
        modal
        open={showCalendar}
        onOpenChange={setShowCalendar}
        anchor={calendarAnchor}
        side="left"
        sideOffset={4}
        collisionPadding={8}
        width="auto"
        content={
          <>
            <div className={styles.dateRangePickerPanelDiv14}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close calendar"
                onClick={() => setShowCalendar(false)}
              >
                <X className={styles.dateRangePickerPanelX} />
              </Button>
            </div>
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
          </>
        }
      />
      <div className={styles.dateRangePickerPanelDiv15}>
        <Input
          placeholder="Filter quick ranges"
          leadingIcon={SearchIcon}
          value={quickRangeFilter}
          onChange={ev => setQuickRangeFilter(ev.target.value)}
        />
        <ScrollArea fill>
          <div className={styles.dateRangePickerPanelDiv16}>
            {dynamicPresets.length > 0
              ? dynamicPresets
                  .filter(preset =>
                    preset.label.toLowerCase().includes(quickRangeFilter.toLowerCase().trim()),
                  )
                  .map(preset => <PresetButton key={preset.name} preset={preset} />)
              : staticPresets
                  .filter(preset =>
                    preset.label.toLowerCase().includes(quickRangeFilter.toLowerCase().trim()),
                  )
                  .map(preset => <PresetButton key={preset.name} preset={preset} />)}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

/** The DateRangePicker component allows a user to select a range of dates */
export function DateRangePicker(props: DateRangePickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const staticPresets = props.presets ?? availablePresets;
  const label = getDateRangeDisplayLabel(props.selectedRange, staticPresets);

  return (
    <Popover
      modal
      open={isOpen}
      onOpenChange={(open: boolean) => {
        setIsOpen(open);
      }}
      trigger={
        props.trigger ?? (
          <Button
            label={label}
            size={props.size}
            rightIcon={{ icon: ChevronDown, withSeparator: true }}
          />
        )
      }
      align={props.align}
      side={props.side}
      width="auto"
      padding="none"
      content={
        <DateRangePickerPanel
          presets={props.presets}
          selectedRange={props.selectedRange}
          onUpdate={props.onUpdate}
          startDate={props.startDate}
          onClose={() => setIsOpen(false)}
          footer={props.footer}
        />
      }
    />
  );
}
