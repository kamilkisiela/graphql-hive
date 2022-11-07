import React from 'react';
import 'twin.macro';
import { Select, CheckboxGroup, Checkbox, Tooltip } from '@chakra-ui/react';
import { VscChevronDown } from 'react-icons/vsc';
import { AdminStats, Filters } from '@/components/admin/AdminStats';
import { Page } from '@/components/common';
import { DATE_RANGE_OPTIONS } from '@/components/common/TimeFilter';
import { authenticated } from '@/components/authenticated-container';
import { withSessionProtection } from '@/lib/supertokens/guard';

function Manage() {
  const [last, setLast] = React.useState(30);
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
    [setFilters, filters]
  );

  return (
    <Page title="Hive Stats">
      <div tw="flex flex-row h-full">
        <div tw="flex-grow overflow-x-auto divide-y divide-gray-200">
          <div tw="w-6/12 mt-10 mb-6">
            <div tw="inline-block">
              <CheckboxGroup
                colorScheme="teal"
                size="sm"
                defaultValue={Object.keys(filters).filter(key => !!filters[key as keyof typeof filters])}
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
              <Tooltip label="Date filter applies only to collected operations data" placement="left">
                <Select
                  defaultValue={last}
                  onChange={ev => setLast(parseInt(ev.target.value, 10))}
                  iconSize="16"
                  icon={<VscChevronDown />}
                  size="sm"
                  tw="inline-block align-middle"
                >
                  {DATE_RANGE_OPTIONS.filter(v => v.asDays).map(item => {
                    return (
                      <option key={item.key} value={item.asDays}>
                        {item.label}
                      </option>
                    );
                  })}
                </Select>
              </Tooltip>
            </div>
          </div>
          <AdminStats last={last} filters={filters} />
        </div>
      </div>
    </Page>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(Manage);
