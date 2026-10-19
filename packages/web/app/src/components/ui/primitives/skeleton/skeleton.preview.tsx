import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Skeleton } from './skeleton';
import * as styles from './skeleton.preview.css';

export const nav: NavPath = 'Primitives/Skeleton';

export const Shapes = createPreview(() => (
  <div className={styles.div}>
    <span className={styles.span}>
      <Skeleton />
      line
    </span>
    <span className={styles.span2}>
      <span className={styles.span3}>
        <Skeleton variants={{ shape: 'block' }} />
      </span>
      block
    </span>
    <span className={styles.span4}>
      <Skeleton variants={{ shape: 'circle' }} />
      circle
    </span>
  </div>
));

export const LineSizes = createPreview(() => (
  <div className={styles.div2}>
    {(['xs', 'sm', 'default', 'lg', 'xl'] as const).map(size => (
      <span key={size} className={styles.span5}>
        <span className={styles.span6}>{size}</span>
        <Skeleton variants={{ size }} />
      </span>
    ))}
  </div>
));

export const LineWidths = createPreview(() => (
  <div className={styles.div3}>
    {(['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const).map(width => (
      <span key={width} className={styles.span7}>
        <span className={styles.span8}>{width}</span>
        <Skeleton variants={{ width }} />
      </span>
    ))}
  </div>
));

// The SSO settings loading state (single-sign-on-subpage.tsx), transcribed: fixed-width spans
// around full-width lines, as the page sizes them.
export const SettingsSections = createPreview(() => (
  <div className={styles.div4}>
    <section className={styles.section}>
      <span className={styles.span9}>
        <Skeleton variants={{ size: 'xl', width: 'full' }} />
      </span>
      <span className={styles.span10}>
        <Skeleton variants={{ width: 'full' }} />
      </span>
      <div className={styles.div5}>
        {[0, 1, 2].map(i => (
          <div key={i} className={styles.div6}>
            <span className={styles.span11}>
              <Skeleton variants={{ width: 'full' }} />
            </span>
            <span className={styles.span12}>
              <Skeleton variants={{ width: 'full' }} />
            </span>
          </div>
        ))}
      </div>
    </section>
    <section className={styles.section2}>
      <span className={styles.span13}>
        <Skeleton variants={{ size: 'xl', width: 'full' }} />
      </span>
      <div className={styles.div7}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className={styles.div8}>
            <span className={styles.span14}>
              <Skeleton variants={{ width: 'full' }} />
            </span>
            <span className={styles.span15}>
              <Skeleton variants={{ width: 'full' }} />
            </span>
          </div>
        ))}
      </div>
    </section>
    <section className={styles.section3}>
      <span className={styles.span16}>
        <Skeleton variants={{ size: 'xl', width: 'full' }} />
      </span>
      <span className={styles.span17}>
        <Skeleton variants={{ width: 'full' }} />
      </span>
      <div className={styles.div9}>
        <span className={styles.span18}>
          <Skeleton variants={{ width: 'full' }} />
        </span>
        <span className={styles.span19}>
          <Skeleton variants={{ width: 'full' }} />
        </span>
      </div>
    </section>
    <section className={styles.section4}>
      <span className={styles.span20}>
        <Skeleton variants={{ size: 'xl', width: 'full' }} />
      </span>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={styles.div10}>
          <div className={styles.div11}>
            <span className={styles.span21}>
              <Skeleton variants={{ width: 'full' }} />
            </span>
            <span className={styles.span22}>
              <Skeleton variants={{ size: 'sm', width: 'full' }} />
            </span>
          </div>
          <span className={styles.span23}>
            <Skeleton variants={{ shape: 'block' }} />
          </span>
        </div>
      ))}
    </section>
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Skeleton, {
    variants: {
      shape: { type: 'radio', options: ['line', 'block', 'circle'], default: 'line' },
      size: { type: 'radio', options: ['xs', 'sm', 'default', 'lg', 'xl'], default: 'default' },
      width: { type: 'radio', options: ['xs', 'sm', 'md', 'lg', 'xl', 'full'], default: 'md' },
    },
  }),
  render: v => (
    <span className={styles.span24}>
      <Skeleton variants={v.variants} />
    </span>
  ),
});
