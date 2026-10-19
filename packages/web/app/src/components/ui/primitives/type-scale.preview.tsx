import { createPreview, type NavPath } from 'react-foundry';
import * as styles from './type-scale.preview.css';

export const nav: NavPath = 'Primitives/Foundations/TypeScale';

/**
 * The type scale: Tailwind's steps plus the two the app kept typing by hand. `control` (13px) is
 * the size of UI text: buttons, inputs, menus, chips, description lists, card bodies. `2xs`
 * (10px) is micro text: badges, subgraph chips, tick labels, mono timestamps. Both carry their
 * own line-height.
 */
const STEPS = [
  { name: '2xs', px: 10, lh: 14, cls: 'text-2xs', use: 'badges, chips, tick labels' },
  { name: 'xs', px: 12, lh: 16, cls: 'text-xs', use: 'secondary text, tooltips, descriptions' },
  { name: 'control', px: 13, lh: 18, cls: 'text-control', use: 'buttons, inputs, menus, chips' },
  { name: 'sm', px: 14, lh: 20, cls: 'text-sm', use: 'body' },
  { name: 'base', px: 16, lh: 24, cls: 'text-base', use: 'lead paragraphs' },
  { name: 'lg', px: 18, lh: 28, cls: 'text-lg', use: 'section headings' },
  { name: 'xl', px: 20, lh: 28, cls: 'text-xl', use: 'page titles' },
  { name: '2xl', px: 24, lh: 32, cls: 'text-2xl', use: 'stat values' },
] as const;

const SAMPLE = 'Schema checks run on the composed API schema.';

export const Steps = createPreview(() => (
  <div className={styles.div}>
    {STEPS.map(step => (
      <div key={step.name} className={styles.div2}>
        <div className={styles.div3}>
          {step.name}
          <br />
          {step.px}/{step.lh}
        </div>
        <div>
          <div className={`${styles.div4} ${step.cls}`}>{SAMPLE}</div>
          <div className={styles.div5}>{step.use}</div>
        </div>
      </div>
    ))}
  </div>
));

/**
 * The three sizes that sit next to each other most often, on one control row: a compact chip
 * (control), its description (xs), and a badge (2xs).
 */
export const SideBySide = createPreview(() => (
  <div className={styles.div6}>
    <span className={styles.span}>Filter</span>
    <span className={styles.span2}>3 dimensions selected</span>
    <span className={styles.span3}>beta</span>
  </div>
));
