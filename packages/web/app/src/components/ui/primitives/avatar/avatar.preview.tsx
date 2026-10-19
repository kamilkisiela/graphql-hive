import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Avatar } from './avatar';
import * as styles from './avatar.preview.css';

export const nav: NavPath = 'Primitives/Avatar';

/** A stand-in photo, inline so the preview needs no network. */
const PHOTO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#5b7cfa"/><circle cx="20" cy="15" r="7" fill="#fff"/><path d="M6 38c2-9 8-13 14-13s12 4 14 13z" fill="#fff"/></svg>',
)}`;

/**
 * Always a circle, because every avatar in the app is one. `xs` (20px) sits beside a name in a
 * table cell; `md` (40px) is the header user menu. Initials come from `alt`; with no name at all,
 * as in the header while the viewer is still loading, it falls back to a person icon.
 */
export const Sizes = createPreview(() => (
  <div className={styles.div}>
    <Avatar size="xs" alt="User" />
    <Avatar size="md" alt="User" />
  </div>
));

export const Initials = createPreview(() => (
  <div className={styles.div2}>
    {['User', 'Ada Lovelace', 'Jean-Luc Picard', 'user@the-guild.dev', ''].map(name => (
      <div key={name} className={styles.div3}>
        <Avatar alt={name} />
        <code className={styles.code}>{name === '' ? '(no alt)' : name}</code>
      </div>
    ))}
  </div>
));

/** `outlined` is the header's accent ring, previously a className at that one call site. */
export const Outlined = createPreview(() => (
  <div className={styles.div4}>
    <Avatar variant="outlined" alt="User" />
    <Avatar variant="outlined" />
  </div>
));

/** No call site passes `src` today; this shows the image path is wired should one appear. */
export const WithImage = createPreview(() => (
  <div className={styles.div5}>
    <Avatar size="xs" src={PHOTO} alt="User" />
    <Avatar size="md" src={PHOTO} alt="User" />
    <Avatar size="md" variant="outlined" src={PHOTO} alt="User" />
  </div>
));

/** The alerts tables: an `xs` avatar and the name it stands for, in a `text-xs` row. */
export const BesideName = createPreview(() => (
  <div className={styles.div6}>
    <span className={styles.span}>
      <Avatar size="xs" alt="User" />
      User
    </span>
    <span className={styles.span2}>
      <Avatar size="xs" alt="Ada Lovelace" />
      Ada Lovelace
    </span>
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Avatar, {
    size: { type: 'radio', options: ['xs', 'md'], default: 'md' },
    variant: { type: 'radio', options: ['default', 'outlined'], default: 'default' },
    alt: { type: 'text', default: 'Ada Lovelace' },
    src: {
      type: 'boolean',
      label: 'Photo',
      default: false,
      derive: on => (on ? PHOTO : undefined),
    },
  }),
  render: v => <Avatar size={v.size} variant={v.variant} alt={v.alt} src={v.src} />,
});
