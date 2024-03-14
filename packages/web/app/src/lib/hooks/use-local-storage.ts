import { useCallback, useState } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    const json = localStorage.getItem(key);
    try {
      return json ? JSON.parse(json) : defaultValue;
    } catch (_) {
      return defaultValue;
    }
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
