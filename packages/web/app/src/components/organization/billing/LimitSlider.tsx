import { Slider, SliderFilledTrack, SliderMark, SliderThumb, SliderTrack, Tooltip } from '@chakra-ui/react';
import { ReactElement, useState } from 'react';
import { Section } from '@/components/common';
import clsx from 'clsx';

export const LimitSlider = (props: {
  value: number;
  min: number;
  max: number;
  step: number;
  title: string;
  onChange: (v: number) => void;
  marks?: { value: number; label: string }[];
  className?: string;
}): ReactElement => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={props.className}>
      <Section.Subtitle className="-ml-2.5">{props.title}</Section.Subtitle>
      <Slider
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        colorScheme="primary"
        onChange={props.onChange}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {props.marks?.map((mark, i, arr) => (
          <SliderMark
            key={mark.value}
            value={mark.value}
            fontSize="sm"
            className={clsx('mt-2', i === arr.length - 1 ? '-ml-7' : '-ml-2.5')}
          >
            {mark.label}
          </SliderMark>
        ))}
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <Tooltip hasArrow placement="top" isOpen={showTooltip} label={props.value}>
          <SliderThumb />
        </Tooltip>
      </Slider>
    </div>
  );
};
