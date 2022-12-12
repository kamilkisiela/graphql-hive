import { ReactElement } from 'react';
import Image, { ImageProps } from 'next/image';
import clsx from 'clsx';
import { Radio, RadioGroup } from '@/components/v2';
import { ProjectType } from '@/graphql';
import { RadioGroupProps } from '@radix-ui/react-radio-group';
import federation from '../../../public/images/figures/federation.svg';
import single from '../../../public/images/figures/single.svg';
import stitching from '../../../public/images/figures/stitching.svg';

const PROJECTS: {
  title: 'REGULAR' | 'DISTRIBUTED';
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
];

export const ProjectTypes = (
  props: Omit<RadioGroupProps, 'children' | 'className'>,
): ReactElement => {
  return (
    <RadioGroup {...props}>
      {PROJECTS.map(({ type, image, title, description }) => {
        const capitalizedType = type[0] + type.slice(1).toLowerCase();
        return (
          <Radio key={type} value={type} className="flex border-transparent bg-gray-800">
            <Image
              src={image}
              alt={`${capitalizedType} project illustration`}
              className="drag-none rounded-sm bg-black"
            />
            <div className="grow p-2.5">
              <h4
                className={clsx(
                  'text-xs font-medium',
                  title === 'DISTRIBUTED' ? 'text-[#1cc8ee]' : 'text-orange-500',
                )}
              >
                {title}
              </h4>
              <h2 className="font-bold leading-none">{capitalizedType}</h2>
              <span className="self-end text-sm font-medium text-gray-500">{description}</span>
            </div>
          </Radio>
        );
      })}
    </RadioGroup>
  );
};
