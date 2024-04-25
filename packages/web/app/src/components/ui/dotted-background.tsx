import React from 'react';

export function DottedBackground(props: { children: React.ReactNode }) {
  return (
    <div className="bg-dot-white/[0.2] relative flex h-full w-full items-center justify-center bg-black">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      {props.children}
    </div>
  );
}
