import { ReactElement } from 'react';
import NextImage, { ImageProps } from 'next/image';
import {
  Indicator,
  Item,
  RadioGroupProps,
  Root,
} from '@radix-ui/react-radio-group';
import clsx from 'clsx';

import { ProjectType } from '@/graphql';
import custom from '../../../public/images/figures/custom.svg';
import federation from '../../../public/images/figures/federation.svg';
import single from '../../../public/images/figures/single.svg';
import stitching from '../../../public/images/figures/stitching.svg';

const PROJECTS: {
  title: 'REGULAR' | 'DISTRIBUTED' | 'CUSTOM';
  type: ProjectType;
  image: ImageProps['src'];
  description: string;
}[] = [
  {
    title: 'REGULAR',
    type: ProjectType.Single,
    image: single,
    description: 'Single API approach',
  },
  {
    title: 'DISTRIBUTED',
    type: ProjectType.Federation,
    image: federation,
    description: 'Apollo Federation specification',
  },
  {
    title: 'DISTRIBUTED',
    type: ProjectType.Stitching,
    image: stitching,
    description: 'Built using Schema Stitching',
  },
  {
    title: 'CUSTOM',
    type: ProjectType.Custom,
    image: custom,
    description: 'Own validation and schema building',
  },
];

export const ProjectTypes = ({
  children,
  className,
  ...props
}: RadioGroupProps): ReactElement => {
  return (
    <Root
      className={clsx('flex flex-col justify-items-stretch gap-4', className)}
      {...props}
    >
      {PROJECTS.map(({ type, image, title, description }) => {
        const capitalizedType = type[0] + type.slice(1).toLowerCase();
        return (
          <Item
            key={type}
            value={type}
            className="
              hover:border-orange-500/50
              relative
              flex
              overflow-hidden
              rounded-sm
              border
              border-transparent
              bg-gray-800
              text-left
              focus:ring
            "
          >
            <NextImage
              src={image}
              alt={`${capitalizedType} project illustration`}
              className="drag-none rounded-sm bg-black"
            />
            <div className="grow p-2.5">
              <h4
                className={clsx(
                  'text-xs font-medium',
                  title === 'DISTRIBUTED' ? 'text-[#1cc8ee]' : 'text-orange-500'
                )}
              >
                {title}
              </h4>
              <h2 className="font-bold leading-none">{capitalizedType}</h2>
              <span className="self-end text-sm font-medium text-gray-500">
                {description}
              </span>
            </div>
            <Indicator className="border-orange-500 absolute inset-0 rounded-md border" />
          </Item>
        );
      })}
    </Root>
  );
};
