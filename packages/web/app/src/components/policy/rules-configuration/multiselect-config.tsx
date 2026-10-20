import { ReactElement, useEffect } from 'react';
import { InfoIcon } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { useConfigurationHelper } from '../form-helper';
import { PolicyConfigBox } from '../policy-config-box';
import * as styles from './multiselect-config.css';

export const PolicyMultiSelect = (props: {
  rule: string;
  propertyName: string;
  defaultValues: string[];
  title: string;
  tooltip?: ReactElement;
  options: {
    value: string;
    label: string;
  }[];
  creatable?: boolean;
}): ReactElement => {
  const { config, setConfig, getConfigValue } = useConfigurationHelper().ruleConfig(props.rule);
  const currentValues = getConfigValue<string[]>(props.propertyName);

  useEffect(() => {
    if (!config && typeof props.defaultValues !== 'undefined') {
      setConfig(props.propertyName, props.defaultValues);
    }
  }, []);

  return (
    <PolicyConfigBox
      title={
        <div className={styles.policyMultiSelectDiv}>
          <div>{props.title}</div>
          {props.tooltip ? (
            <Popover
              trigger={
                <button
                  type="button"
                  aria-label="About this option"
                  className={styles.policyMultiSelectButton}
                >
                  <InfoIcon className={styles.policyMultiSelectInfoIcon} />
                </button>
              }
              openOnHover
              content={<p className={styles.policyMultiSelectP}>{props.tooltip}</p>}
            />
          ) : null}
        </div>
      }
    >
      <Combobox
        name="options"
        inputId={`${props.rule}_${props.propertyName}`}
        placeholder="Select Options"
        className={styles.policyMultiSelectCombobox}
        onBlur={() => {}}
        onChange={newValue => {
          setConfig(
            props.propertyName,
            newValue.map(o => o.value),
          );
        }}
        creatable={props.creatable}
        options={props.options || []}
        value={(currentValues ?? []).map(v => ({
          value: v,
          label: v,
        }))}
      />
    </PolicyConfigBox>
  );
};
