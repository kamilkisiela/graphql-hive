import { ReactNode } from 'react';
import reactStringReplace from 'react-string-replace';
import { Label } from '@/components/common';

export function labelize(message: string): ReactNode[] {
  // Replace '...' with <Label>...</Label>
  return reactStringReplace(message, /'([^']+)'/gim, (match, i) => (
    <Label key={i} dangerouslySetInnerHTML={{ __html: match }} />
  ));
}
