import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { StatusDot } from './status-dot';
import * as styles from './status-dot.preview.css';

export const nav: NavPath = 'Primitives/StatusDot';

/** One solid dot per state, on the semantic tokens. */
export const Colors = createPreview(() => (
  <div className={styles.div}>
    {(['success', 'warning', 'critical', 'info', 'neutral'] as const).map(color => (
      <span key={color} className={styles.span}>
        <StatusDot color={color} />
        {color}
      </span>
    ))}
  </div>
));

export const Sizes = createPreview(() => (
  <div className={styles.div2}>
    <span className={styles.span2}>
      <StatusDot color="success" />
      default, 8px
    </span>
  </div>
));

/** Beside a label that already names the state, the dot is decoration and hidden from assistive tech. */
export const BesideText = createPreview(() => (
  <div className={styles.div3}>
    <span className={styles.span3}>
      <StatusDot color="critical" />
      Critical
    </span>
    <span className={styles.span4}>
      <StatusDot color="warning" />
      Warning
    </span>
    <span className={styles.span5}>
      <StatusDot color="info" />
      Info
    </span>
  </div>
));

/** Alone, as in the checks list where the dot is the only sign a check failed, it carries a label. */
export const Alone = createPreview(() => (
  <div className={styles.div4}>
    <StatusDot color="success" label="Passed" />
    <StatusDot color="critical" label="Failed" />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(StatusDot, {
    color: {
      type: 'select',
      options: ['success', 'warning', 'critical', 'info', 'neutral'],
      default: 'success',
    },
    size: { type: 'radio', options: ['default'], default: 'default' },
  }),
  render: v => <StatusDot color={v.color} size={v.size} />,
});
