import React from 'react';
import startOfMonth from 'date-fns/startOfMonth';
import subDays from 'date-fns/subDays';
import subHours from 'date-fns/subHours';
import { VscChevronDown } from 'react-icons/vsc';
import 'twin.macro';
import { AdminStats, Filters } from '@/components/admin/AdminStats';
import { authenticated } from '@/components/authenticated-container';
import { Page } from '@/components/common';
import { DATE_RANGE_OPTIONS, floorToMinute } from '@/components/common/TimeFilter';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { Checkbox, CheckboxGroup, Select, Tooltip } from '@chakra-ui/react';

type DateRangeOptions = Exclude<
  (typeof DATE_RANGE_OPTIONS)[number],
  {
    key: 'all';
  }
>;

function isNotAllOption(option: (typeof DATE_RANGE_OPTIONS)[number]): option is DateRangeOptions {
  return option.key !== 'all';
}

const dateRangeOptions = DATE_RANGE_OPTIONS.filter(isNotAllOption);

function Manage() {
  const [dateRangeKey, setDateRangeKey] = React.useState<DateRangeOptions['key']>('30d');
  const [filters, setFilters] = React.useState<Filters>({});
  const onFiltersChange = React.useCallback(
    (keys: Array<keyof Filters>) => {
      const newFilters: {
        [key in keyof Filters]: boolean;
      } = {
        'only-regular': false,
        'with-collected': false,
        'with-schema-pushes': false,
        'with-persisted': false,
        'with-projects': false,
        'with-targets': false,
      };

      for (const key of keys) {
        newFilters[key] = true;
      }

      setFilters(newFilters);
    },
    [setFilters, filters],
  );

  const dateRange = React.useMemo(() => {
    const to = floorToMinute(new Date());

    if (dateRangeKey === 'month') {
      return {
        from: startOfMonth(new Date()),
        to,
      };
    }

    const unit = dateRangeKey.endsWith('d') ? 'd' : 'h';
    const value = parseInt(dateRangeKey.replace(unit, ''));

    return {
      from: unit === 'd' ? subDays(to, value) : subHours(to, value),
      to,
    };
  }, [dateRangeKey]);

  return (
    <Page title="Hive Stats">
      <div tw="flex flex-row h-full">
        <div tw="flex-grow overflow-x-auto divide-y divide-gray-200">
          <div tw="w-6/12 mt-10 mb-6">
            <div tw="inline-block">
              <CheckboxGroup
                colorScheme="teal"
                size="sm"
                defaultValue={Object.keys(filters).filter(
                  key => filters[key as keyof typeof filters],
                )}
                onChange={onFiltersChange}
              >
                <Checkbox tw="whitespace-nowrap align-middle" value="only-regular">
                  <Tooltip label="Do not count personal organizations, created automatically for every user">
                    Only Regular
                  </Tooltip>
                </Checkbox>
                <Checkbox tw="whitespace-nowrap align-middle" value="with-projects">
                  With Projects
                </Checkbox>
                <Checkbox tw="whitespace-nowrap align-middle" value="with-targets">
                  With Targets
                </Checkbox>
                <Checkbox tw="whitespace-nowrap align-middle" value="with-schema-pushes">
                  With Schema Pushes
                </Checkbox>
                <Checkbox tw="whitespace-nowrap align-middle" value="with-persisted">
                  With Persisted
                </Checkbox>
                <Checkbox tw="whitespace-nowrap align-middle" value="with-collected">
                  With Collected
                </Checkbox>
              </CheckboxGroup>
              <Tooltip
                label="Date filter applies only to collected operations data"
                placement="left"
              >
                <Select
                  defaultValue={dateRangeKey}
                  onChange={ev => setDateRangeKey(ev.target.value as DateRangeOptions['key'])}
                  iconSize="16"
                  icon={<VscChevronDown />}
                  size="sm"
                  tw="inline-block align-middle"
                >
                  {dateRangeOptions.map(item => {
                    return (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    );
                  })}
                </Select>
              </Tooltip>
            </div>
          </div>
          <AdminStats dateRange={dateRange} filters={filters} />
        </div>
      </div>
    </Page>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(Manage);
