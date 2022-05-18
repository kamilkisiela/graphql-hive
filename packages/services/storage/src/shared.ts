/**
 * Slonik 23.8.X requires an index signature in types (which is weird)
 */
export type Slonik<T extends { [key: string]: any }> = {
  [K in keyof T]: T[K];
} & {
  [key: string]: null;
};
