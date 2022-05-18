import {
  Slider,
  SliderFilledTrack,
  SliderMark,
  SliderThumb,
  SliderTrack,
  Tooltip,
} from '@chakra-ui/react';
import 'twin.macro';
import React from 'react';
import { Section } from '@/components/common';

export const LimitSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  title: string;
  onChange: (v: number) => void;
  marks?: { value: number; label: string }[];
}> = (props) => {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div tw="mt-4 mb-8">
      <Section.Subtitle>{props.title}</Section.Subtitle>
      <Slider
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        colorScheme="primary"
        onChange={(v) => props.onChange(v)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {(props.marks || []).map((mark) => (
          <SliderMark
            key={mark.value}
            value={mark.value}
            mt="1"
            ml="-2.5"
            fontSize="sm"
          >
            {mark.label}
          </SliderMark>
        ))}
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <Tooltip
          hasArrow
          color="white"
          placement="top"
          isOpen={showTooltip}
          label={`${props.value}`}
        >
          <SliderThumb />
        </Tooltip>
      </Slider>
    </div>
  );
};
