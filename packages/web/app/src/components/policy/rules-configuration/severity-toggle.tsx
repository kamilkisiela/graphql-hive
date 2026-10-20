import { ReactElement } from 'react';
import clsx from 'clsx';
import { CircleMinus, CircleX, TriangleAlert } from 'lucide-react';
import { ToggleGroup } from '@/components/ui/primitives/toggle-group/toggle-group';
import { RuleInstanceSeverityLevel } from '@/gql/graphql';
import { useConfigurationHelper } from '../form-helper';
import { PolicyConfigBox } from '../policy-config-box';
import * as styles from './severity-toggle.css';

export const SeverityLevelToggle = (props: { rule: string; canTurnOff: boolean }): ReactElement => {
  const config = useConfigurationHelper().ruleConfig(props.rule);
  const options = [
    {
      value: RuleInstanceSeverityLevel.Warning,
      label: 'Warning',
      icon: (active: boolean) => (
        <TriangleAlert
          className={clsx(
            styles.severityLevelToggleTriangleAlert,
            active
              ? styles.severityLevelToggleTriangleAlert2
              : styles.severityLevelToggleTriangleAlert3,
            styles.severityLevelToggleTriangleAlert4,
          )}
        />
      ),
    },
    {
      value: RuleInstanceSeverityLevel.Error,
      label: 'Error',
      icon: (active: boolean) => (
        <CircleX
          className={clsx(
            styles.severityLevelToggleCircleX,
            active ? styles.severityLevelToggleCircleX2 : styles.severityLevelToggleCircleX3,
            styles.severityLevelToggleCircleX4,
          )}
        />
      ),
    },
  ];

  if (props.canTurnOff) {
    options.unshift({
      value: RuleInstanceSeverityLevel.Off,
      label: 'Disables a rule defined at the organization level',
      icon: (active: boolean) => (
        <CircleMinus
          className={clsx(
            styles.severityLevelToggleCircleMinus,
            active
              ? styles.severityLevelToggleCircleMinus2
              : styles.severityLevelToggleCircleMinus3,
            styles.severityLevelToggleCircleMinus4,
          )}
        />
      ),
    });
  }

  return (
    <PolicyConfigBox title="severity" className={styles.severityLevelTogglePolicyConfigBox}>
      <ToggleGroup
        options={options.map(level => ({
          value: level.value,
          label: level.icon(config.severity === level.value),
          tooltip: level.label,
        }))}
        value={config.severity}
        onValueChange={newValue => {
          config.setSeverity(newValue as RuleInstanceSeverityLevel);
        }}
        aria-label="Severity"
      />
    </PolicyConfigBox>
  );
};
