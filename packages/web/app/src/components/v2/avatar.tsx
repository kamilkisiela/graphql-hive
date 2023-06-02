import { ReactElement, ReactNode } from 'react';
import clsx from 'clsx';
import { Image, Root } from '@radix-ui/react-avatar';
import { PersonIcon } from '@radix-ui/react-icons';

type Size = 'lg' | 'md' | 'sm' | 'xs';
//           50     40     34     20

type AvatarProps = {
  src?: string | null;
  alt?: string;
  shape?: 'circle' | 'square';
  size?: Size;
  fallback?: ReactNode;
};

export const Avatar = ({
  src,
  alt,
  shape = 'square',
  size = 'md',
  className,
  ...props
}: AvatarProps & { className?: string }): ReactElement => {
  return (
    <Root
      className={clsx(
        // By default Root has `span` element with `display: inline` property
        'flex shrink-0 items-center justify-center overflow-hidden bg-gray-900',
        shape === 'square' ? (size === 'lg' ? 'rounded-md' : 'rounded-sm') : 'rounded-full',
        {
          xs: 'h-5 w-5',
          sm: 'h-9 w-9',
          md: 'h-10 w-10',
          lg: 'h-[50px] w-[50px]',
        }[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <>
          <Image
            src={src ?? undefined}
            alt={alt}
            className="drag-none h-full w-full object-cover"
          />
        </>
      ) : (
        <PersonIcon />
      )}
    </Root>
  );
};
