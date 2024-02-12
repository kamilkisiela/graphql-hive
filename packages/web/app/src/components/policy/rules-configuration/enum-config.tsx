import { ReactElement, useEffect } from 'react';
import clsx from 'clsx';
import { InfoIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem, Tooltip } from '../../v2';
import { useConfigurationHelper } from '../form-helper';
import { PolicyConfigBox } from '../policy-config-box';

export const PolicyEnumSelect = (props: {
  rule: string;
  propertyName: string;
  defaultValue: string;
  title: string;
  tooltip?: ReactElement;
  options: {
    value: string;
    label: string;
  }[];
}): ReactElement => {
  const { config, setConfig, getConfigValue } = useConfigurationHelper().ruleConfig(props.rule);
  const currentValue = getConfigValue<string>(props.propertyName);

  useEffect(() => {
    if (!config) {
      setConfig(props.propertyName, props.defaultValue);
    }
  }, []);

  return (
    <PolicyConfigBox
      title={
        <div className="flex items-center">
          <div>{props.title}</div>
          {props.tooltip ? (
            <Tooltip content={props.tooltip}>
              <InfoIcon className="ml-2 size-4 text-orange-500" />
            </Tooltip>
          ) : null}
        </div>
      }
    >
      <ToggleGroup
        defaultValue="list"
        onValueChange={newValue => {
          if (newValue) {
            setConfig(props.propertyName, newValue);
          }
        }}
        value={currentValue}
        type="single"
        className="bg-gray-900/50 text-gray-500"
      >
        {props.options.map(option => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            title={option.label}
            className={clsx(
              'text-xs hover:text-white',
              currentValue === option.value && 'bg-gray-800 text-white',
            )}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </PolicyConfigBox>
  );
};
