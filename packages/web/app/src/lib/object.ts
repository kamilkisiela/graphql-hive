export const pick = <TValue extends Record<string, any>>(value: TValue, keys: string[]) => {
  return keys.reduce(
    (acc, key) => {
      if (key in value) {
        acc[key] = value[key];
      }
      return acc;
    },
    {} as Record<string, any>,
  );
};
