import { useState } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { FloatingSearch } from './floating-search';
import * as styles from './floating-search.preview.css';

export const nav: NavPath = 'Primitives/Floating/Search';

const ITEMS = ['production', 'staging', 'development', 'preview', 'canary'];

/**
 * Normally rendered inside a floating popup, so it is shown here on a panel-like
 * surface rather than bare on the canvas.
 */
export const Default = createPreview(() => {
  const [search, setSearch] = useState('');
  const matches = ITEMS.filter(item => item.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.div}>
      <FloatingSearch label="targets" value={search} onSearch={setSearch} />
      <div className={styles.div2}>
        {matches.length === 0 ? (
          <div className={styles.div3}>No matches</div>
        ) : (
          matches.map(item => (
            <div key={item} className={styles.div4}>
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  );
});

/**
 * The `standalone` form, as the filter menu's text dimension renders it: the input is the whole
 * panel, and the panel is unpadded and scrolls. It should fill the panel with no scrollbar.
 */
export const Standalone = createPreview(() => {
  const [search, setSearch] = useState('');

  return (
    <div className={styles.div5}>
      <FloatingSearch
        label="fields"
        value={search}
        onSearch={setSearch}
        placeholder="Find field"
        standalone
      />
    </div>
  );
});

export const WithValue = createPreview(() => {
  const [search, setSearch] = useState('prod');

  return (
    <div className={styles.div6}>
      <FloatingSearch
        label="targets"
        value={search}
        onSearch={setSearch}
        placeholder="Find field"
        standalone
      />
    </div>
  );
});
