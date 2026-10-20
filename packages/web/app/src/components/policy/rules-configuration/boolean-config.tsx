import { ReactElement, useEffect } from 'react';
import { Checkbox } from '@/components/ui/primitives/checkbox/checkbox';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { useConfigurationHelper } from '../form-helper';
import { PolicyConfigBox } from '../policy-config-box';
import * as styles from './boolean-config.css';

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
      className={styles.policyBooleanToggleLabel}
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
          checked={currentValue ?? props.defaultValue}
          onCheckedChange={newValue => setConfig(props.propertyName, newValue)}
        />
      </div>
      <div className={styles.policyBooleanToggleDiv}>
        {props.tooltip ? <Tooltip trigger={label} content={props.tooltip} /> : label}
      </div>
    </PolicyConfigBox>
  );
};
