import { ComponentProps, ReactElement } from 'react';
import { clsx } from 'clsx';
import * as styles from './stat.css';

function Stat({ children, className }: ComponentProps<'dl'>): ReactElement {
  return <dl className={clsx(styles.statDl, className)}>{children}</dl>;
}

function Label({ children, className }: ComponentProps<'dt'>): ReactElement {
  return <dt className={clsx(styles.labelDt, className)}>{children}</dt>;
}

function Number({ children, className }: ComponentProps<'dd'>): ReactElement {
  return <dd className={clsx(styles.numberDd, className)}>{children}</dd>;
}

function HelpText({ children, className }: ComponentProps<'dd'>): ReactElement {
  return <dd className={clsx(styles.helpTextDd, className)}>{children}</dd>;
}

export default Object.assign(Stat, { Label, Number, HelpText });
