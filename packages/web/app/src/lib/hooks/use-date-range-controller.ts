import { useState } from 'react';
import {
  addDays,
  addHours,
  endOfHour,
  endOfMinute,
  formatISO,
  startOfHour,
  startOfMinute,
  subHours,
  subMilliseconds,
  subSeconds,
} from 'date-fns';
import { availablePresets, buildDateRangeString, Preset } from '@/components/ui/date-range-picker';
import { parse, resolveRange } from '@/lib/date-math';
import { subDays } from '@/lib/date-time';
import { useRouter } from '@tanstack/react-router';
import { useResetState } from './use-reset-state';

export function useDateRangeController(args: {
  dataRetentionInDays: number;
  defaultPreset: Preset;
}) {
  const router = useRouter();

  const [startDate] = useResetState(
    () => subDays(new Date(), args.dataRetentionInDays),
    [args.dataRetentionInDays],
  );

  const searchParams = router.latestLocation.search;
  // const params = new URLSearchParams(urlParameter);
  const fromRaw = (('from' in searchParams && searchParams.from) ?? '') as string;
  const toRaw = (('to' in searchParams && searchParams.to) ?? 'now') as string;

  const [selectedPreset] = useResetState(() => {
    const preset = availablePresets.find(p => p.range.from === fromRaw && p.range.to === toRaw);

    if (preset) {
      return preset;
    }

    const from = parse(fromRaw);
    const to = parse(toRaw);

    if (!from || !to) {
      return args.defaultPreset;
    }

    return {
      name: `${fromRaw}_${toRaw}`,
      label: buildDateRangeString({ from, to }),
      range: { from: fromRaw, to: toRaw },
    };
  }, [fromRaw, toRaw]);

  const [triggerRefreshCounter, setTriggerRefreshCounter] = useState(0);
  const [resolved] = useResetState(() => {
    const parsed = resolveRange(selectedPreset.range);

    const from = new Date(parsed.from);
    let to = new Date(parsed.to);

    if (from.getTime() === to.getTime()) {
      to = subSeconds(addHours(new Date(), 20), 1);
    }

    const resolved = resolveRangeAndResolution({
      from,
      to,
    });

    return {
      resolution: resolved.resolution,
      range: {
        from: formatISO(resolved.range.from),
        to: formatISO(resolved.range.to),
      },
    };
  }, [selectedPreset.range, triggerRefreshCounter]);

  return {
    startDate,
    selectedPreset,
    setSelectedPreset(preset: Preset) {
      void router.navigate({
        search: {
          ...searchParams,
          from: preset.range.from,
          to: preset.range.to,
        },
        replace: true,
      });
    },
    resolvedRange: resolved.range,
    refreshResolvedRange() {
      setTriggerRefreshCounter(c => c + 1);
    },
    resolution: resolved.resolution,
  } as const;
}

const maximumResolution = 90;
const minimumResolution = 1;

function resolveResolution(resolution: number) {
  return Math.max(minimumResolution, Math.min(resolution, maximumResolution));
}

const msMinute = 60 * 1000;
const msHour = msMinute * 60;
const msDay = msHour * 24;

const thresholdDataPointPerDay = 28;
const thresholdDataPointPerHour = 24;

const tableTTLInHours = {
  daily: 365 * 24,
  hourly: 30 * 24,
  minutely: 24,
};

/** Get the UTC start date of a day */
function getUTCStartOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Get the UTC end date of a day */
function getUTCEndOfDay(date: Date) {
  return subMilliseconds(getUTCStartOfDay(addDays(date, 1)), 1);
}

export function resolveRangeAndResolution(range: { from: Date; to: Date }, now = new Date()) {
  const tableOldestDateTimePoint = {
    /** Because ClickHouse uses UTC and we aggregate to UTC start fo day, we need to get the UTC day here */
    daily: getUTCStartOfDay(subHours(now, tableTTLInHours.daily)),
    hourly: startOfHour(subHours(now, tableTTLInHours.hourly)),
    minutely: startOfMinute(subHours(now, tableTTLInHours.minutely)),
  };

  if (
    range.to.getTime() <= tableOldestDateTimePoint.daily.getTime() ||
    range.from.getTime() <= tableOldestDateTimePoint.daily.getTime()
  ) {
    throw new Error('This range can never be resolved.');
  }

  const daysDifference = (range.to.getTime() - range.from.getTime()) / msDay;

  if (
    daysDifference > thresholdDataPointPerDay ||
    /** if we are outside this range, we always need to get daily data */
    range.to.getTime() <= tableOldestDateTimePoint.hourly.getTime() ||
    range.from.getTime() <= tableOldestDateTimePoint.hourly.getTime()
  ) {
    const resolvedRange = {
      from: getUTCStartOfDay(range.from),
      to: getUTCEndOfDay(range.to),
    };
    const daysDifference = Math.floor(
      (resolvedRange.to.getTime() - resolvedRange.from.getTime()) / msDay,
    );

    // try to have at least 1 data points per day, unless the range has more than 90 days.
    return {
      resolution: resolveResolution(daysDifference),
      range: resolvedRange,
    };
  }

  const hoursDifference = (range.to.getTime() - range.from.getTime()) / msHour;

  if (
    hoursDifference > thresholdDataPointPerHour ||
    /** if we are outside this range, we always need to get hourly data */
    range.to.getTime() <= tableOldestDateTimePoint.minutely.getTime() ||
    range.from.getTime() <= tableOldestDateTimePoint.minutely.getTime()
  ) {
    const resolvedRange = {
      from: startOfHour(range.from),
      to: endOfHour(range.to),
    };
    const hoursDifference = Math.floor(
      (resolvedRange.to.getTime() - resolvedRange.from.getTime()) / msHour,
    );

    // try to have at least 1 data points per hour, unless the range has more than 90 hours.
    return {
      resolution: resolveResolution(hoursDifference),
      range: resolvedRange,
    };
  }

  const resolvedRange = {
    from: startOfMinute(range.from),
    to: endOfMinute(range.to),
  };

  const minutesDifference = Math.floor(
    (resolvedRange.to.getTime() - resolvedRange.from.getTime()) / msMinute,
  );

  return {
    resolution: resolveResolution(minutesDifference),
    range: resolvedRange,
  };
}
