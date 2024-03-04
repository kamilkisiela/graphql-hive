import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { availablePresets, buildDateRangeString, Preset } from '@/components/ui/date-range-picker';
import { parse, resolveRange } from '@/lib/date-math';
import { subDays } from '@/lib/date-time';
import { useResetState } from './use-reset-state';

export function useDateRangeController(args: {
  dataRetentionInDays: number;
  defaultPreset: Preset;
}) {
  const router = useRouter();
  const [href, urlParameter] = router.asPath.split('?');

  const [startDate] = useResetState(
    () => subDays(new Date(), args.dataRetentionInDays),
    [args.dataRetentionInDays],
  );

  const params = new URLSearchParams(urlParameter);
  const fromRaw = params.get('from') ?? '';
  const toRaw = params.get('to') ?? 'now';

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
  const [resolvedRange] = useResetState(
    () => resolveRange(selectedPreset.range),
    [selectedPreset.range, triggerRefreshCounter],
  );

  const resolution = useMemo(() => {
    const timeDifference =
      new Date(resolvedRange.to).getTime() - new Date(resolvedRange.from).getTime();

    const timeDifferenceInHours = timeDifference / 1000 / 60 / 60;
    const timeDifferenceInDays = timeDifference / 1000 / 60 / 60 / 24;

    if (timeDifferenceInDays > 90) {
      return 90;
    }

    if (timeDifferenceInDays === 1) {
      return 24;
    }

    if (timeDifferenceInDays > 1) {
      let diff = Math.floor(timeDifferenceInDays);
      let size = diff;
      while (size < 20) {
        size = size + diff;
      }

      return size;
    }

    let size = timeDifferenceInHours;
    while (size < 20) {
      size = size + timeDifferenceInHours;
    }

    return size;
  }, [resolvedRange]);

  return {
    startDate,
    selectedPreset,
    setSelectedPreset(preset: Preset) {
      router.push(
        `${href}?from=${encodeURIComponent(preset.range.from)}&to=${encodeURIComponent(preset.range.to)}`,
        undefined,
        {
          scroll: false,
          shallow: true,
        },
      );
    },
    resolvedRange,
    refreshResolvedRange() {
      setTriggerRefreshCounter(c => c + 1);
    },
    resolution,
  } as const;
}
