import { ReactElement, useEffect } from 'react';
import { Checkbox, Tooltip } from '@/components/v2';
import { useConfigurationHelper } from '../form-helper';
import { PolicyConfigBox } from '../policy-config-box';

export const PolicyBooleanToggle = (props: {
  rule: string;
  title: string;
  propertyName: string;
  defaultValue: boolean;
  tooltip?: ReactElement;
}): ReactElement => {
  const { config, setConfig, getConfigValue } = useConfigurationHelper().ruleConfig(props.rule);
  const currentValue = getConfigValue<boolean>(props.propertyName);

  useEffect(() => {
    if (!config) {
      setConfig(props.propertyName, props.defaultValue);
    }
  }, []);

  const label = (
    <label
      className="pb-1 pl-2 font-mono text-xs text-gray-500"
      htmlFor={`${props.rule}_${props.propertyName}`}
    >
      {props.title}
    </label>
  );

  return (
    <PolicyConfigBox>
      <div>
        <Checkbox
          id={`${props.rule}_${props.propertyName}`}
          value={props.rule}
          checked={currentValue}
          onCheckedChange={newValue => setConfig(props.propertyName, newValue)}
        />
      </div>
      <div className="grow">
        {props.tooltip ? <Tooltip content={props.tooltip}>{label}</Tooltip> : label}
      </div>
    </PolicyConfigBox>
  );
};
