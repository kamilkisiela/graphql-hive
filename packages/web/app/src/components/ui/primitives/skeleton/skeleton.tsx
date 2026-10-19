import { lenient } from '@/lib/recipe';
import * as styles from './skeleton.css';

// bg-fixed pins the gradient to the viewport, so every skeleton on the page shares one shimmer
// instead of each running its own.
const skeletonVariants = lenient(styles.skeletonVariants);

type SkeletonProps = {
  variants?: NonNullable<Parameters<typeof skeletonVariants>[0]>;
};

export function Skeleton({ variants }: SkeletonProps) {
  return <span aria-hidden className={skeletonVariants({ ...variants })} />;
}
