import { ReactElement, useEffect } from 'react';
import { InfoIcon } from 'lucide-react';
import { Input, Tooltip } from '@/components/v2';
import { useConfigurationHelper } from '../form-helper';
import { PolicyConfigBox } from '../policy-config-box';

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
        <div className="flex items-center">
          <div>{props.title}</div>
          {props.tooltip ? (
            <Tooltip content={props.tooltip}>
              <InfoIcon className="ml-2 h-4 w-4 text-orange-500" />
            </Tooltip>
          ) : null}
        </div>
      }
    >
      <Input
        className="h-5"
        id={`${props.rule}_${props.propertyName}`}
        value={currentValue || ''}
        onChange={e => setConfig(props.propertyName, e.target.value)}
      />
    </PolicyConfigBox>
  );
};
