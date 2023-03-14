import { ForwardRefExoticComponent } from 'react';
import clsx from 'clsx';
import { Item, Root } from '@radix-ui/react-toggle-group';

type PropsOf<T> = T extends ForwardRefExoticComponent<infer P> ? P : unknown;

type RootProps = PropsOf<typeof Root>;
type ItemProps = PropsOf<typeof Item>;

export const ToggleGroup = ({ className, children, ...props }: RootProps) => {
  return (
    <Root className={clsx('inline-flex rounded-md shadow-sm', className)} {...props}>
      {children}
    </Root>
  );
};

export const ToggleGroupItem = ({ className, children, ...props }: ItemProps) => {
  return (
    <Item
      className={clsx(
        'flex items-center justify-center p-2 first:ml-0 first:rounded-l-md last:rounded-r-md',
        className,
      )}
      {...props}
    >
      {children}
    </Item>
  );
};

//   '&:hover': { backgroundColor: violet.violet3 },
//   '&[data-state=on]': {
//     backgroundColor: violet.violet5,
//     color: violet.violet11,
//   },
//   '&:focus': { position: 'relative', boxShadow: `0 0 0 2px black` },
// });
