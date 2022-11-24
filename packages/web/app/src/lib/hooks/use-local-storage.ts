import { useState, useCallback } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    const json = localStorage.getItem(key);
    return json ? JSON.parse(json) : defaultValue;
  });

  const set = useCallback(
    (value: T) => {
      localStorage.setItem(key, JSON.stringify(value));
      setValue(value);
    },
    [setValue],
  );

  return [value, set] as const;
}
