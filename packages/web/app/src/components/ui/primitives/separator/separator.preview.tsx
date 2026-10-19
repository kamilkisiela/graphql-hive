import { useState } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { Select } from '../floating/select/select';
import { Input } from '../input/input';
import { Separator } from './separator';
import * as styles from './separator.preview.css';

export const nav: NavPath = 'Primitives/Separator';

export const Horizontal = createPreview(() => (
  <div className={styles.div}>
    <p>Schema checks run on the composed API schema.</p>
    <Separator />
    <p>Each check compares against the latest valid version.</p>
  </div>
));

/**
 * The toolbar above the projects and targets lists: search, a divider, sort. The divider is a
 * control's height (32px) so it reads as part of the row; the spacing around it is the row's
 * gap.
 */
export const InToolbar = createPreview(() => {
  const [sortBy, setSortBy] = useState('requests');
  return (
    <div className={styles.div2}>
      <Input type="search" placeholder="Search..." />
      <Separator orientation="vertical" />
      <Select
        options={[
          {
            value: 'requests',
            label: 'Requests',
            description: 'GraphQL requests made in the last 7 days.',
          },
          {
            value: 'versions',
            label: 'Schema Versions',
            description: 'Schemas published in last 7 days.',
          },
          { value: 'name', label: 'Name', description: 'Sort by project name.' },
        ]}
        value={sortBy}
        onValueChange={setSortBy}
      />
    </div>
  );
});

/** `stretch` fills the row instead, for a divider between things taller than a control. */
export const Stretch = createPreview(() => (
  <div className={styles.div3}>
    <div className={styles.div4}>A tall neighbour</div>
    <Separator orientation="vertical" />
    <span>control height</span>
    <Separator orientation="vertical" stretch />
    <span>stretch</span>
  </div>
));
