import { ComponentProps, ReactElement } from 'react';
import { clsx } from 'clsx';

function Stat({ children, className }: ComponentProps<'dl'>): ReactElement {
  return <dl className={clsx('leading-6', className)}>{children}</dl>;
}

function Label({ children, className }: ComponentProps<'dt'>): ReactElement {
  return <dt className={clsx('text-sm font-medium', className)}>{children}</dt>;
}

function Number({ children, className }: ComponentProps<'dd'>): ReactElement {
  return <dd className={clsx('text-2xl font-semibold', className)}>{children}</dd>;
}

function HelpText({ children, className }: ComponentProps<'dd'>): ReactElement {
  return <dd className={clsx('text-sm opacity-80', className)}>{children}</dd>;
}

export default Object.assign(Stat, { Label, Number, HelpText });
