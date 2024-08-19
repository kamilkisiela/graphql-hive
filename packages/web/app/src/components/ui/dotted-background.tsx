import React from 'react';
import { clsx } from 'clsx';

export function DottedBackground(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'bg-dot-white/[0.2] relative flex size-full items-center justify-center bg-black',
        props.className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      {props.children}
    </div>
  );
}
