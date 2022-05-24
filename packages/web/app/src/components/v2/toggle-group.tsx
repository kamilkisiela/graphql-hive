import { ForwardRefExoticComponent } from 'react';
import { Root, Item } from '@radix-ui/react-toggle-group';
import clsx from 'clsx';

type PropsOf<T> = T extends ForwardRefExoticComponent<infer P> ? P : unknown;

type RootProps = PropsOf<typeof Root>;
type ItemProps = PropsOf<typeof Item>;

export const ToggleGroup = (props: RootProps) => {
  return (
    <Root
      {...props}
      className={clsx('inline-flex rounded-md shadow-sm', props.className)}
    >
      {props.children}
    </Root>
  );
};
export const ToggleGroupItem = (props: ItemProps) => {
  return (
    <Item
      {...props}
      className={clsx(
        'flex items-center justify-center p-2 first:ml-0 first:rounded-l-md last:rounded-r-md',
        props.className
      )}
    >
      {props.children}
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
