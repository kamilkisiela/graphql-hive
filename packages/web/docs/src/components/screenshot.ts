import { cloneElement, ReactElement } from 'react';

export function Screenshot({ children }: { children: ReactElement }) {
  return cloneElement(children, { className: 'mt-6 rounded-lg drop-shadow-md' });
}
