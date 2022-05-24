import { ReactElement } from 'react';
import { Fallback, Image, Root } from '@radix-ui/react-avatar';
import clsx from 'clsx';

type Size = 'lg' | 'md' | 'sm' | 'xs';
//           50     40     34     20

type AvatarProps = {
  src: string;
  alt?: string;
  shape?: 'circle' | 'square';
  size?: Size;
  fallback?: any;
};

export const Avatar = ({
  src,
  alt,
  shape = 'square',
  size = 'md',
  fallback,
  className,
  ...props
}: AvatarProps & { className?: string }): ReactElement => {
  return (
    <Root
      className={clsx(
        // By default Root has `span` element with `display: inline` property
        'flex shrink-0 items-center justify-center overflow-hidden bg-gray-800',
        shape === 'square'
          ? size === 'lg'
            ? 'rounded-md'
            : 'rounded-sm'
          : 'rounded-full',
        {
          xs: 'h-5 w-5',
          sm: 'h-9 w-9',
          md: 'h-10 w-10',
          lg: 'h-[50px] w-[50px]',
        }[size],
        className
      )}
      {...props}
    >
      <Image
        src={src}
        alt={alt}
        className="drag-none h-full w-full object-cover"
      />
      {fallback && <Fallback delayMs={500}>{fallback}</Fallback>}
    </Root>
  );
};
