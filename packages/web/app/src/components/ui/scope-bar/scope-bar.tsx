import { type ReactNode } from 'react';

type ScopeBarProps = {
  picker: ReactNode;
  label?: string;
};

/** Sits above a TabbedView: the picker that scopes every tab. */
export function ScopeBar({ picker, label = 'Viewing' }: ScopeBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-control text-fg-secondary">{label}</span>
      {picker}
    </div>
  );
}
