import React from 'react';
import { formatISO, subDays } from 'date-fns';
import { useLocalStorage } from '@/lib/hooks/use-local-storage';

export type PeriodOption = '365d' | '180d' | '90d' | '30d' | '14d' | '7d';
export type Period = {
  from: string;
  to: string;
};

function floorDate(date: Date): Date {
  const time = 1000 * 60;
  return new Date(Math.floor(date.getTime() / time) * time);
}

function createPeriod(option: PeriodOption): Period {
  const now = floorDate(new Date());
  const value = parseInt(option.replace('d', ''), 10);

  return {
    from: formatISO(subDays(now, value)),
    to: formatISO(now),
  };
}

const SchemaExplorerContext = React.createContext<{
  isArgumentListCollapsed: boolean;
  setArgumentListCollapsed(isCollapsed: boolean): void;
  setPeriodOption(option: PeriodOption): void;
  periodOption: PeriodOption;
  availablePeriodOptions: PeriodOption[];
  period: Period;
}>({
  isArgumentListCollapsed: true,
  setArgumentListCollapsed: () => {},
  periodOption: '7d',
  period: createPeriod('7d'),
  availablePeriodOptions: ['7d'],
  setPeriodOption: () => {},
});

export function SchemaExplorerProvider(
  props: React.PropsWithChildren<{
    dataRetentionInDays: number;
  }>,
) {
  const { dataRetentionInDays } = props;
  const [isArgumentListCollapsed, setArgumentListCollapsed] = useLocalStorage(
    'hive:schema-explorer:collapsed',
    true,
  );
  const [periodOption, setPeriodOption] = useLocalStorage<PeriodOption>(
    'hive:schema-explorer:period',
    '30d',
  );
  const [period, setPeriod] = React.useState(createPeriod(periodOption));

  React.useEffect(() => {
    const inDays = parseInt(periodOption.replace('d', ''), 10);
    if (dataRetentionInDays < inDays) {
      updatePeriod(dataRetentionInDays > 7 ? '30d' : '7d');
    }
  }, [periodOption, setPeriodOption]);

  const updatePeriod = React.useCallback(
    option => {
      setPeriodOption(option);
      setPeriod(createPeriod(option));
    },
    [setPeriodOption, setPeriod],
  );

  const availablePeriodOptions = React.useMemo(() => {
    const options: PeriodOption[] = ['365d', '180d', '90d', '30d', '14d', '7d'];

    return options.filter(option => parseInt(option.replace('d', ''), 10) <= dataRetentionInDays);
  }, [periodOption]);

  return (
    <SchemaExplorerContext.Provider
      value={{
        isArgumentListCollapsed,
        setArgumentListCollapsed,
        period,
        setPeriodOption: updatePeriod,
        periodOption,
        availablePeriodOptions,
      }}
    >
      {props.children}
    </SchemaExplorerContext.Provider>
  );
}

export function useSchemaExplorerContext() {
  return React.useContext(SchemaExplorerContext);
}

export function useArgumentListToggle() {
  const { isArgumentListCollapsed, setArgumentListCollapsed } = useSchemaExplorerContext();
  const toggle = React.useCallback(() => {
    setArgumentListCollapsed(!isArgumentListCollapsed);
  }, [setArgumentListCollapsed, isArgumentListCollapsed]);

  return [isArgumentListCollapsed, toggle] as const;
}

const periodLabelMap: {
  [key in PeriodOption]: string;
} = {
  '365d': 'Last year',
  '180d': 'Last 6 months',
  '90d': 'Last 3 months',
  '30d': 'Last 30 days',
  '14d': 'Last 14 days',
  '7d': 'Last 7 days',
};

export function usePeriodSelector() {
  const { availablePeriodOptions, setPeriodOption, periodOption } = useSchemaExplorerContext();
  return {
    options: availablePeriodOptions.map(option => ({
      label: periodLabelMap[option],
      value: option,
    })),
    onChange: setPeriodOption,
    value: periodOption,
  };
}
