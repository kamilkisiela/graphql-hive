import { useState } from 'react';
import {
  Copy,
  FileText,
  Globe,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { createPreview, type NavPath } from 'react-foundry';
import { Button } from '../../button/button';
import { Menu, type MenuSection } from './menu';
import * as styles from './menu.preview.css';

export const nav: NavPath = 'Primitives/Floating/Menu';

/**
 * A menu is described, not composed. `sections` takes data, and `Menu` renders the rows, the
 * separators between sections and any submenu popups itself. There is no `MenuItem` to assemble
 * by hand, and no `key` to thread through.
 *
 * See `Anatomy` for every part in one menu, then the previews after it for each kind alone.
 */
export const Default = createPreview(() => (
  <Menu
    trigger={<Button label="Open menu" />}
    sections={[
      [
        { label: 'Settings', icon: Settings },
        { label: 'Documentation', icon: FileText },
      ],
    ]}
  />
));

/**
 * Every part of the API in one menu, as a reference. Top to bottom: a labelled section, action
 * rows with leading and trailing icons, a row rendered as a link, a selected row, a disabled row
 * that explains itself on hover, a checkbox, a toggle, a submenu of rows, a submenu holding a
 * custom panel, a radio group, and a destructive row.
 *
 * Separators are implied: each array in `sections` is one group, and `Menu` rules between them.
 */
export const Anatomy = createPreview(() => {
  function Preview() {
    const [theme, setTheme] = useState('system');
    const [compact, setCompact] = useState(false);
    const [showArchived, setShowArchived] = useState(true);

    const sections: MenuSection[] = [
      // A `header` names who or what the menu belongs to. Not a row, and not a section label.
      [{ kind: 'header', title: 'User', subtitle: 'user@the-guild.dev' }],
      // An object section adds a heading and puts its rows in a labelled group.
      {
        label: 'Workspace',
        items: [
          { label: 'Settings', icon: Settings },
          // `trailingIcon` sits at the right edge, as an affordance rather than a category.
          { label: 'Invite people', icon: UserPlus, trailingIcon: Copy },
          // `render` swaps the row's element, keeping full typing on a TanStack Link or an <a>.
          { label: 'Documentation', icon: FileText, render: <a href="#docs">Documentation</a> },
        ],
      },
      // A plain array is an unlabelled section.
      [
        // `selected` reflects state the page owns. For a choice the menu owns, use `radio`.
        { label: 'the-guild' },
        { label: 'hive-staging', selected: true },
        // `tooltip` renders on a wrapper, so it still fires while the row is disabled.
        { label: 'acme-corp', disabled: true, tooltip: 'You do not have access to this org.' },
      ],
      [
        // Both keep the menu open by default, since they change something in place.
        { kind: 'checkbox', label: 'Compact rows', checked: compact, onCheckedChange: setCompact },
        {
          kind: 'toggle',
          label: 'Show archived',
          checked: showArchived,
          onCheckedChange: setShowArchived,
        },
      ],
      [
        // A submenu of rows: `items` is sections all the way down.
        {
          kind: 'submenu',
          label: 'Theme',
          icon: Sun,
          items: [
            [
              {
                kind: 'radio',
                value: theme,
                onValueChange: setTheme,
                options: [
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ],
              },
            ],
          ],
        },
        // A submenu whose body is a custom panel rather than rows. The escape hatch, for things
        // like the filter dropdown's value list.
        {
          kind: 'submenu',
          label: 'Regions',
          icon: Globe,
          content: (
            <div className={styles.previewDiv}>
              Any panel can go here. This one is not a list of rows.
            </div>
          ),
        },
      ],
      [{ label: 'Sign out', icon: LogOut, variant: 'destructiveAction' }],
    ];

    return <Menu trigger={<Button label="Everything" />} minWidth="md" sections={sections} />;
  }

  return <Preview />;
});

/** Each array in `sections` is a group; `Menu` draws the rule between them. */
export const Sections = createPreview(() => (
  <Menu
    trigger={<Button label="Account" />}
    sections={[
      [
        { label: 'Settings', icon: Settings },
        { label: 'Documentation', icon: FileText },
      ],
      [{ label: 'Sign out', icon: LogOut }],
    ]}
  />
));

/** The object section form. Its rows sit inside the group, so the heading names them. */
export const LabelledSection = createPreview(() => (
  <Menu
    trigger={<Button label="Options" />}
    sections={[
      { label: 'Options', items: [{ label: 'View details' }, { label: 'Duplicate' }] },
      [{ label: 'Delete', icon: Trash2, variant: 'destructiveAction' }],
    ]}
  />
));

/**
 * `header` versus a section `label`. The header identifies who the menu belongs to and is not a
 * row; the label names the rows beneath it. Both are non-interactive, which is why they sit next
 * to each other here.
 */
export const Header = createPreview(() => (
  <Menu
    trigger={<Button label="Account" />}
    minWidth="md"
    sections={[
      [{ kind: 'header', title: 'User', subtitle: 'user@the-guild.dev' }],
      { label: 'Workspace', items: [{ label: 'Settings' }, { label: 'Members' }] },
      [{ label: 'Sign out', variant: 'destructiveAction' }],
    ]}
  />
));

/** The four row variants. `navigationLink` appends its own arrow. */
export const ItemVariants = createPreview(() => (
  <Menu
    trigger={<Button label="Variants" />}
    sections={[
      [
        { label: 'Default' },
        { label: 'Action', variant: 'action' },
        { label: 'Destructive', icon: Trash2, variant: 'destructiveAction' },
        { label: 'Navigation link', variant: 'navigationLink' },
      ],
    ]}
  />
));

/**
 * `disabled` alone gives no reason. Pair it with `tooltip`, which renders on a wrapper so it
 * still fires: a disabled row sets `pointer-events-none` and would never see the hover.
 */
export const DisabledWithReason = createPreview(() => (
  <Menu
    trigger={<Button label="Open menu" />}
    sections={[
      [
        { label: 'Enabled row' },
        { label: 'Disabled, no reason given', disabled: true },
        {
          label: 'Disabled, explained',
          disabled: true,
          tooltip: 'Only an admin can edit this role.',
        },
      ],
    ]}
  />
));

/** `checkbox` shows a check, `toggle` a switch. Both keep the menu open by default. */
export const CheckboxAndToggle = createPreview(() => {
  function Preview() {
    const [compact, setCompact] = useState(false);
    const [archived, setArchived] = useState(true);

    return (
      <Menu
        trigger={<Button label="View options" />}
        minWidth="md"
        sections={[
          [
            {
              kind: 'checkbox',
              label: 'Compact rows',
              checked: compact,
              onCheckedChange: setCompact,
            },
            {
              kind: 'toggle',
              label: 'Show archived',
              checked: archived,
              onCheckedChange: setArchived,
            },
          ],
        ]}
      />
    );
  }

  return <Preview />;
});

/**
 * `radio` for a choice the menu itself owns: `menuitemradio` rows with a trailing check, so they
 * keep the same left edge as the icon-first rows around them.
 */
export const RadioGroup = createPreview(() => {
  function Preview() {
    const [theme, setTheme] = useState('system');

    return (
      <Menu
        trigger={<Button label="Theme" />}
        sections={[
          [
            {
              kind: 'radio',
              value: theme,
              onValueChange: setTheme,
              options: [
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ],
            },
          ],
        ]}
      />
    );
  }

  return <Preview />;
});

/**
 * A submenu is an entry with `items`, not a nested `Menu`. It positions itself to the right and
 * appends its own chevron. Nesting goes as deep as you like, since `items` is sections again.
 */
export const Submenu = createPreview(() => (
  <Menu
    trigger={<Button label="Account" />}
    sections={[
      [
        { label: 'Settings', icon: Settings },
        {
          kind: 'submenu',
          label: 'Switch organization',
          items: [
            [
              { label: 'the-guild' },
              { label: 'hive-staging', selected: true },
              { kind: 'submenu', label: 'Archived', items: [[{ label: 'old-project' }]] },
            ],
          ],
        },
      ],
    ]}
  />
));

/** A submenu can hold a panel instead of rows, via `content`. */
export const SubmenuWithPanel = createPreview(() => (
  <Menu
    trigger={<Button label="Filters" />}
    sections={[
      [
        {
          kind: 'submenu',
          label: 'Clients',
          maxWidth: 'lg',
          content: <div className={styles.div}>A search field, a virtualized list, anything.</div>,
        },
      ],
    ]}
  />
));

/**
 * `width` fixes the popup so it does not resize between states, which is what the settings
 * tables' row-action menus want. `minWidth`/`maxWidth` are the usual choice.
 */
export const Widths = createPreview(() => (
  <div className={styles.div2}>
    <Menu
      trigger={<Button label="width=sm (160px)" />}
      width="sm"
      sections={[[{ label: 'Edit' }, { label: 'Delete' }]]}
    />
    <Menu
      trigger={<Button label="minWidth=md (240px)" />}
      minWidth="md"
      sections={[[{ label: 'Short' }]]}
    />
    <Menu
      trigger={<Button label="maxWidth=default (300px)" />}
      maxWidth="default"
      sections={[
        [{ label: 'A deliberately long row label that has to wrap against the maximum width' }],
      ]}
    />
  </div>
));

/** `minWidth="none"` for a menu that should hug its content. */
export const Compact = createPreview(() => (
  <Menu
    trigger={<Button label="Sort" />}
    minWidth="none"
    sections={[[{ label: 'Ascending' }, { label: 'Descending' }]]}
  />
));

const unset = (value: string) => (value === 'unset' ? undefined : value);

export const Playground = createPreview({
  controls: {
    side: { type: 'radio', options: ['bottom', 'top', 'left', 'right'], default: 'bottom' },
    align: { type: 'radio', options: ['start', 'center', 'end'], default: 'start' },
    minWidth: {
      type: 'select',
      options: ['unset', 'none', 'default', 'sm', 'md'],
      default: 'unset',
      derive: unset,
    },
    maxWidth: {
      type: 'select',
      options: ['unset', 'none', 'default', 'sm', 'lg'],
      default: 'unset',
      derive: unset,
    },
    width: { type: 'select', options: ['unset', 'none', 'sm'], default: 'unset', derive: unset },
    header: { type: 'boolean', default: true },
    indicator: { type: 'radio', options: ['check', 'switch'], default: 'check' },
    externalLink: { type: 'boolean', default: true },
    destructive: { type: 'boolean', default: true },
  },
  render: v => {
    const [compact, setCompact] = useState(false);
    const sections: MenuSection[] = [
      [v.header && { kind: 'header', title: 'User', subtitle: 'user@the-guild.dev' }],
      [
        { label: 'Settings', icon: Settings },
        { label: 'Copy link', icon: Copy, variant: 'action' },
        {
          kind: 'link',
          label: 'Documentation',
          icon: FileText,
          href: 'https://the-guild.dev/graphql/hive/docs',
          external: v.externalLink,
        },
      ],
      [
        {
          kind: 'checkbox',
          label: 'Compact rows',
          checked: compact,
          onCheckedChange: setCompact,
          indicator: v.indicator as 'check' | 'switch',
        },
      ],
      [v.destructive && { label: 'Log out', icon: LogOut, variant: 'destructiveAction' }],
    ];
    return (
      <Menu
        trigger={<Button label="Open menu" />}
        side={v.side as 'bottom'}
        align={v.align as 'start'}
        minWidth={v.minWidth as 'default' | undefined}
        maxWidth={v.maxWidth as 'default' | undefined}
        width={v.width as 'sm' | undefined}
        sections={sections}
      />
    );
  },
});

/**
 * Falsy entries are dropped and an empty section is skipped, separators included, so a row can be
 * written as `cond && {…}` without the call site filtering first. Only two rows render here.
 */
export const ConditionalRows = createPreview(() => {
  const canEdit = false;
  const canDelete = true;

  return (
    <Menu
      trigger={<Button label="Open menu" />}
      sections={[
        [{ label: 'View details' }, canEdit && { label: 'Edit' }],
        // This whole section disappears, and so does the rule that would precede it.
        [canEdit && { label: 'Rename' }],
        [canDelete && { label: 'Delete', variant: 'destructiveAction' as const }],
      ]}
    />
  );
});
