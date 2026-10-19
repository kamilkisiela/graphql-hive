import { useState } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { Slider } from './slider';
import * as styles from './slider.preview.css';

export const nav: NavPath = 'Primitives/FormControls/Slider';

/** One thumb, one value. The filled range is accent so the position reads at a glance. */
export const Controlled = createPreview(() => {
  const [value, setValue] = useState(12);
  return (
    <div className={styles.div}>
      <Slider min={1} max={300} value={value} onValueChange={setValue} aria-label="Operations" />
      <span className={styles.span}>{value}M operations per month</span>
    </div>
  );
});

/** Snaps to the nearest step; arrow keys move one step, Page Up/Down ten. */
export const Stepped = createPreview(() => {
  const [value, setValue] = useState(50);
  return (
    <div className={styles.div2}>
      <Slider
        min={0}
        max={100}
        step={25}
        value={value}
        onValueChange={setValue}
        aria-label="Share"
      />
      <span className={styles.span2}>{value}%</span>
    </div>
  );
});

/** A two-element value gives two thumbs, for a bounded range such as the traces duration filter. */
export const Range = createPreview(() => {
  const [range, setRange] = useState<[number, number]>([2000, 60_000]);
  return (
    <div className={styles.div3}>
      <Slider min={0} max={100_000} value={range} onValueChange={setRange} aria-label="Duration" />
      <span className={styles.span3}>
        {range[0]} ms to {range[1]} ms
      </span>
    </div>
  );
});

export const Disabled = createPreview(() => (
  <div className={styles.div4}>
    <Slider
      min={1}
      max={300}
      value={120}
      onValueChange={() => {}}
      disabled
      aria-label="Operations"
    />
  </div>
));

/** At the ends of the range the thumb stays inside the track rather than overhanging it. */
export const Extremes = createPreview(() => (
  <div className={styles.div5}>
    <Slider min={0} max={10} value={0} onValueChange={() => {}} aria-label="Minimum" />
    <Slider min={0} max={10} value={10} onValueChange={() => {}} aria-label="Maximum" />
  </div>
));

export const Playground = createPreview({
  controls: {
    range: { type: 'boolean', default: false },
    min: { type: 'number', default: 0 },
    max: { type: 'number', default: 100 },
    step: { type: 'number', default: 1, min: 1 },
    disabled: { type: 'boolean', default: false },
  },
  // Keyed so switching between one and two thumbs starts from a value of the right shape.
  render: v => <SliderPlayground key={String(v.range)} {...v} />,
});

function SliderPlayground(props: {
  range: boolean;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
}) {
  const [single, setSingle] = useState(props.min);
  const [range, setRange] = useState<[number, number]>([props.min, props.max]);
  return (
    <div className={styles.sliderPlaygroundDiv}>
      {props.range ? (
        <Slider
          value={range}
          onValueChange={setRange}
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
          aria-label="Range"
        />
      ) : (
        <Slider
          value={single}
          onValueChange={setSingle}
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
          aria-label="Value"
        />
      )}
      <span className={styles.sliderPlaygroundSpan}>
        {props.range ? `${range[0]} to ${range[1]}` : single}
      </span>
    </div>
  );
}
