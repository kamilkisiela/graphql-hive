import { ReactElement, useEffect } from 'react';
import { InfoIcon } from 'lucide-react';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { Input } from '@/components/ui/primitives/input/input';
import { useConfigurationHelper } from '../form-helper';
import { PolicyConfigBox } from '../policy-config-box';
import * as styles from './string-config.css';

export const PolicyStringInputConfig = (props: {
  rule: string;
  title: string;
  propertyName: string;
  defaultValue: string;
  tooltip?: ReactElement;
}): ReactElement => {
  const { config, setConfig, getConfigValue } = useConfigurationHelper().ruleConfig(props.rule);
  const currentValue = getConfigValue<string | undefined>(props.propertyName);

  useEffect(() => {
    if (!config) {
      setConfig(props.propertyName, props.defaultValue);
    }
  }, []);

  return (
    <PolicyConfigBox
      title={
        <div className={styles.policyStringInputConfigDiv}>
          <div>{props.title}</div>
          {props.tooltip ? (
            <Popover
              trigger={
                <button
                  type="button"
                  aria-label="About this option"
                  className={styles.policyStringInputConfigButton}
                >
                  <InfoIcon className={styles.policyStringInputConfigInfoIcon} />
                </button>
              }
              openOnHover
              content={<p className={styles.policyStringInputConfigP}>{props.tooltip}</p>}
            />
          ) : null}
        </div>
      }
    >
      <Input
        size="compact"
        id={`${props.rule}_${props.propertyName}`}
        value={currentValue || ''}
        onChange={e => setConfig(props.propertyName, e.target.value)}
      />
    </PolicyConfigBox>
  );
};
