/**
 * The app's global stylesheets, in the one order that works. Import this module, never the files.
 *
 * 1. `layers.css` declares the cascade layers before anything can use them.
 * 2. `preflight.css` is the reset. It goes before Tailwind so that Tailwind's own base rules
 *    (such as `* { border-color }`) still come later in source order and win their ties, exactly
 *    as they did when Tailwind shipped the reset itself.
 * 3. `index.css` is Tailwind, still active while the migration to Vanilla Extract runs.
 * 4. `theme.css` is the Vanilla Extract side of the theme layer. Until Tailwind is removed it
 *    repeats what Tailwind emits, with identical values.
 */
import './layers.css';
import './preflight.css';
import '../index.css';
import './theme.css';
