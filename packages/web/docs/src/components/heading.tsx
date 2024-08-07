import { ComponentPropsWithoutRef } from 'react';
import { cn } from '../lib';

export interface HeadingProps extends ComponentPropsWithoutRef<'h1'> {
  as: 'h1' | 'h2' | 'h3';
  size: 'xl' | 'md' | 'sm';
}
export function Heading({ as: _as, size, className, ...rest }: HeadingProps) {
  const Level = _as || 'h2';

  let sizeStyle = '';
  switch (size) {
    case 'xl':
      sizeStyle = 'text-4xl leading-[1.2] md:text-6xl md:leading-[1.1875] tracking-[-0.64px]';
      break;
    case 'md':
      sizeStyle = 'text-4xl leading-[1.2] md:text-5xl md:leading-[1.16667] tracking-[-0.48px]';
      break;
    case 'sm':
      sizeStyle = 'text-[40px] leading-[1.2] tracking-[-0.2px]';
      break;
  }

  return <Level className={cn(sizeStyle, className)} {...rest} />;
}
