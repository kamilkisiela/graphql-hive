import { type ReactNode } from 'react';
import connection from '../../../../public/images/figures/connection.svg?url';
import ghost from '../../../../public/images/figures/ghost.svg?url';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/primitives/button/button';
import { lenient } from '@/lib/recipe';
import { useRouter } from '@tanstack/react-router';
import * as styles from './not-found.css';

const illustrations = {
  ghost,
  connection,
};

export const resourceAccessDescription = (
  <>
    <p>It seems like you do not have access to this resource or it does not exist.</p>
    <p>Please check again with your organization admin.</p>
  </>
);

// `px-6` on the root rather than on `horizontal` alone: the centred layout needs it too once the
// viewport is narrow enough for a long title to reach the edges.
export const notFoundVariants = lenient(styles.notFoundVariants);

type NotFoundProps = {
  /**
   * Display line above the title, for the route-level 404's "404". The title carries the meaning,
   * so keep this short.
   */
  bigHeading?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Browser history back, so it is a no-op when the page was opened as a first-load deep link. */
  showBackButton?: boolean;
  variants?: NonNullable<Parameters<typeof notFoundVariants>[0]> & {
    illustration?: keyof typeof illustrations;
  };
};

export function NotFound({
  bigHeading,
  title,
  description,
  showBackButton = true,
  variants,
}: NotFoundProps) {
  const router = useRouter();

  const image = (
    <img
      src={illustrations[variants?.illustration ?? 'ghost']}
      alt=""
      width={200}
      height={200}
      className={clsx(styles.notFoundImg, 'drag-none')}
    />
  );

  const heading = bigHeading ? <p className={styles.notFoundP}>{bigHeading}</p> : null;
  const titleEl = <h2 className={styles.notFoundH2}>{title}</h2>;
  const descriptionEl = description ? (
    <div className={styles.notFoundDiv}>{description}</div>
  ) : null;
  const backButton = showBackButton ? (
    <div className={styles.notFoundDiv2}>
      <Button variant="outline" onClick={() => router.history.back()}>
        Go back
      </Button>
    </div>
  ) : null;

  if (variants?.layout === 'horizontal') {
    return (
      <div className={notFoundVariants({ ...variants })}>
        <div className={styles.notFoundDiv3}>
          {image}
          <div className={styles.notFoundDiv4}>
            {heading}
            {titleEl}
            {descriptionEl ? <div className={styles.notFoundDiv5}>{descriptionEl}</div> : null}
            {backButton}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={notFoundVariants({ ...variants })}>
      {image}
      {heading}
      {titleEl}
      {descriptionEl}
      {backButton}
    </div>
  );
}
