/** The runtime shape of a `@vanilla-extract/recipes` recipe, without its generic parameter. */
type AnyRecipe = ((options?: any) => string) & {
  variants: () => PropertyKey[];
  classNames: unknown;
};

type Options<R> = R extends (options?: infer O) => string ? NonNullable<O> : never;

/** What a lenient recipe accepts: each variant optional, and `null` meaning "the default". */
export type LenientOptions<R> = { [K in keyof Options<R>]?: Options<R>[K] | null };

export type LenientRecipe<R extends AnyRecipe> = ((options?: LenientOptions<R>) => string) &
  Pick<R, 'variants' | 'classNames'>;

/**
 * A recipe that behaves like the `cva` it replaced: keys it has no variant for are ignored, and
 * `null` selects the default. `recipe` itself throws on an unknown key, which breaks the common
 * pattern of spreading one `variants` object into several recipes.
 */
export function lenient<R extends AnyRecipe>(recipe: R): LenientRecipe<R> {
  const known = new Set<PropertyKey>(recipe.variants());
  const fn = ((options?: Record<string, unknown>) => {
    if (!options) return recipe();
    const picked: Record<string, unknown> = {};
    for (const key of Object.keys(options)) {
      if (known.has(key) && options[key] !== null) picked[key] = options[key];
    }
    return recipe(picked);
  }) as LenientRecipe<R>;
  fn.variants = recipe.variants;
  fn.classNames = recipe.classNames;
  return fn;
}
