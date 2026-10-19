# tailwind-to-ve

Codemod that moves `packages/web/app` from Tailwind class strings to Vanilla Extract styles. It is
run once per directory during the migration and then deleted with the rest of the Tailwind setup.

```sh
pnpm codemod:tailwind-to-ve --scope components/ui [--scope pages] [--dry --print] [--force]
```

`--scope` is a directory or file under `packages/web/app/src`; pass it more than once for more.
`--dry` changes nothing and `--print` writes what would be generated to stdout. `--force` overwrites
a `.css.ts` that already exists, which otherwise stops the run, since a hand-edited one would be
lost.

## How it works

1. **Scan** every source file for class strings: a `className` attribute, any string inside a call
   to `cn`, `clsx`, `cva` or `twMerge`, or a constant whose name ends in `class`, `classes`,
   `className`, `style`, `styles`, `variant` or `variants` (and anything in a `*styles.ts` file). A
   constant counts only if every token is a known class, so prose and paths stay untouched.
2. **Compile** the union of all classes once with Tailwind's own compiler, from the app's
   `index.css`, and index the output by class. The CSS for a class is therefore exactly what ships
   today, and its position in Tailwind's output is kept as its cascade order.
3. **Rewrite** each file in scope. Every class string becomes a `style()` in a sibling `.css.ts`,
   built by merging its classes' declarations in Tailwind's order, so a later utility overrides an
   earlier one just as in the real stylesheet. The string in the source becomes a reference:
   `className="flex gap-2"` → `className={styles.cardRoot}`.
4. **Write** `src/styles/tailwind-defaults.css`: Tailwind's default theme variables (`--spacing`,
   `--text-sm`, `--font-weight-medium`, …), `@property` registrations and keyframes that the
   compiled styles reference, computed over the whole app so it is complete from the first run.
5. **Format** with Prettier and ESLint `--fix`, then print a report.

## Mapping

| Tailwind                                                      | Vanilla Extract                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| plain utilities                                               | properties on the style object                                                                                                                                                                                     |
| `hover:`, `focus-visible:`, `disabled:`, `aria-*:`, `data-*:` | `selectors: { '&:hover': … }`, inside the `@media (hover: hover)` Tailwind wraps them in                                                                                                                           |
| `dark:`                                                       | `selectors: { '&:where(.dark, .dark *)': … }`                                                                                                                                                                      |
| `md:`, `print:`, `motion-safe:`                               | `'@media': { '(width >= 48rem)': … }`                                                                                                                                                                              |
| `group-hover:`, `peer-checked:`                               | the same selector Tailwind emits, keyed on the literal `group`/`peer` class, which stays in the `className` as a string                                                                                            |
| `[&_svg]:`, `*:`, `space-x-*`, `divide-*`                     | a `globalStyle` on the generated class, because the subject is a descendant                                                                                                                                        |
| `--tw-*` variables                                            | `vars` on the style; their `@property` registrations go to `tailwind-defaults.css`                                                                                                                                 |
| `container`, `thin-scrollbar`, `no-scrollbar`, `bg-dot-*`     | the hand-ported exports in `src/styles/utilities.css.ts` and `patterns.css.ts`, composed in                                                                                                                        |
| `cva(base, { variants, compoundVariants, defaultVariants })`  | `recipe({ base, variants, compoundVariants: [{ variants, style }], defaultVariants })`; array selections are expanded; composed constants (`focusRing`) become composition entries with their imports carried over |
| `VariantProps<typeof x>`                                      | `NonNullable<RecipeVariants<typeof x>>`                                                                                                                                                                            |
| unknown classes (`graphiql-*`, `hive-*`)                      | kept as a literal, combined with `cn`/`clsx`, and listed in the report                                                                                                                                             |

## Cascade layers

Styles from `components/ui`, `components/v2` and `components/base` go in the `components` layer;
everything else goes in `utilities`. Both are Tailwind's own layer names (see
`src/styles/layers.css.ts`), so while the two systems coexist a Tailwind utility on a call site
still beats a component's base style, which is what `cn(base, className)` relied on `tailwind-merge`
for. After Tailwind is gone the same two layers keep that relationship.

## What it leaves for a human

The report lists them per file:

- `cva` calls that are not static (a variant computed at runtime, or composing a local value).
- Classes built in template literals, such as `` `hover:${color}` ``.
- Classes Tailwind did not recognise.

Also not handled here: call sites that pass `className` through a variants function
(`buttonVariants({ variant, className })`), which `recipe` does not accept.
