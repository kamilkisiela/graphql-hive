/**
 * Rows per page of a check's change lists. The check page's queries ask for the same number with
 * `first: 300`. Its own module so route specs can mock a smaller page.
 */
export const CHANGES_PAGE_SIZE = 300;
