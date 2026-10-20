import { type ReactNode } from 'react';
import * as styles from './shared.css';

/**
 * Shared furniture for the inventory previews in this folder.
 *
 * Each preview here transcribes every real call site of a `ui/` or `v2/` component queued for
 * migration to `primitives/`, rendering the **old** component as it ships today. That gives a "before"
 * to judge a replacement against, and a coverage checklist to migrate through.
 *
 * These live outside `primitives/` on purpose: they import the old components, and `primitives/`
 * should not grow edges into the legacy `ui/` components even in preview files.
 *
 * Not named `*.preview.tsx`, so foundry does not mount it as a preview of its own.
 */

/**
 * One transcribed call site, captioned with where it came from.
 *
 * The caption is rendered rather than left as a source comment because these previews are meant
 * to be read in foundry, where the file itself is not visible.
 */
export function CallSite(props: {
  /** Repo-relative path and line, e.g. `pages/organization.tsx:224`. */
  source: string;
  /** Which legacy folder the component being rendered comes from. */
  origin: Origin;
  /** What makes this call site worth its own entry, when that is not obvious. */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.callSiteDiv}>
      <div className={styles.callSiteDiv2}>
        <span className={styles.callSiteSpan}>
          <OriginTag origin={props.origin} />
          <code className={styles.callSiteCode}>{props.source}</code>
        </span>
        {props.note ? <p className={styles.callSiteP}>{props.note}</p> : null}
      </div>
      {props.children}
    </div>
  );
}

/** Several call sites that share a shape, shown together under one heading. */
export function CallSiteGroup(props: { label: string; children: ReactNode }) {
  return (
    <section className={styles.callSiteGroupSection}>
      <h3 className={styles.callSiteGroupH3}>{props.label}</h3>
      {props.children}
    </section>
  );
}

/**
 * Which folder the call site imports from. Several components exist in both legacy folders with
 * different APIs, so the folder is part of identifying what a call site actually uses. `base` marks
 * a site that has already migrated: it is listed so the inventory stays a complete count, and so
 * the preview shows the thing that actually ships there. `raw` is a site that uses no component at
 * all, a hand-built element doing the same job, which a round has to fold in or rule out.
 */
export type Origin = 'ui' | 'v2' | 'base' | 'raw';

export type InventoryEntry = {
  /** Repo-relative path and line. */
  source: string;
  /** Which legacy folder the component being used comes from. */
  origin: Origin;
  /** What the call site does, in a few words. */
  what: string;
  /**
   * Set when this entry is represented by another preview rather than one of its own, which is
   * how components with too many instances to transcribe individually are covered.
   */
  coveredBy?: string;
};

/** Folder tag, so a v2 call site is not mistaken for a ui one when skimming the list. */
export function OriginTag(props: { origin: Origin }) {
  return (
    <span
      className={
        {
          ui: 'rounded-xs bg-surface-hover px-1 py-px font-mono text-2xs leading-none text-fg-default',
          v2: 'rounded-xs bg-surface-selected px-1 py-px font-mono text-2xs leading-none text-fg',
          base: 'rounded-xs bg-success-muted/20 px-1 py-px font-mono text-2xs leading-none text-success-muted',
          raw: 'rounded-xs bg-warning-tint px-1 py-px font-mono text-2xs leading-none text-warning-text',
        }[props.origin]
      }
    >
      {props.origin}
    </span>
  );
}

/**
 * The "where is this used" screen: every call site of the old component, whether or not it has a
 * preview of its own. Read it as a coverage checklist while migrating.
 */
export function InventoryList(props: {
  component: string;
  /** Anything worth knowing before reading the list: instance counts, dead exports, oddities. */
  summary?: ReactNode;
  entries: readonly InventoryEntry[];
}) {
  return (
    <div className={styles.inventoryListDiv}>
      <div className={styles.inventoryListDiv2}>
        <h3 className={styles.inventoryListH3}>{props.component}</h3>
        <p className={styles.inventoryListP}>{props.entries.length} call sites</p>
        {props.summary ? <div className={styles.inventoryListDiv3}>{props.summary}</div> : null}
      </div>
      <ul className={styles.inventoryListUl}>
        {props.entries.map(entry => (
          <li key={entry.source} className={styles.inventoryListLi}>
            <span className={styles.inventoryListSpan}>
              <OriginTag origin={entry.origin} />
              <code className={styles.inventoryListCode}>{entry.source}</code>
            </span>
            <span className={styles.inventoryListSpan2}>
              {entry.what}
              {entry.coveredBy ? ` — covered by "${entry.coveredBy}"` : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
