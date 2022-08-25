import { useState, useCallback } from 'react';

export function useToggle(defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);
  const toggle = useCallback(() => {
    setValue(value => !value);
  }, []);

  return [value, toggle] as const;
}
