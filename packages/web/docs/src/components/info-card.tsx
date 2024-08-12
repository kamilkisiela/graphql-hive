import { ReactNode } from 'react';
import { cn } from '../lib';
import { Stud } from './stud';

export interface InfoCardProps extends React.HTMLAttributes<HTMLElement> {
  icon: ReactNode;
  heading: ReactNode;
  as?: 'div' | 'li';
}
export function InfoCard({
  as: Root = 'div',
  icon,
  heading,
  className,
  children,
  ...rest
}: InfoCardProps) {
  return (
    <Root className={cn('bg-beige-100 rounded-3xl p-12', className)} {...rest}>
      <Stud>{icon}</Stud>
      <h3 className="text-green-1000 mt-6 text-xl font-medium leading-[1.4]">{heading}</h3>
      <p className="mt-4 text-green-800">{children}</p>
    </Root>
  );
}
