import { Slider as BaseSlider } from '@base-ui/react/slider';
import { focusRing } from '../shared-styles';
import * as styles from './slider.css';

/** One thumb for a number; two, for a bounded range such as a duration filter, for a pair. */
type SliderValue = number | [number, number];

// Generic rather than a union of two prop shapes, so an inline `onValueChange` is typed from
// `value` (a union would leave its parameter implicitly `any`).
type SliderProps<V extends SliderValue> = {
  value: V;
  onValueChange: (value: V) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /**
   * What the value is, for assistive tech; the visible label is the readout beside the slider.
   * A range slider names its thumbs "<label> minimum" and "<label> maximum".
   */
  'aria-label': string;
};

export function Slider<V extends SliderValue>({
  value,
  onValueChange,
  min,
  max,
  step,
  disabled,
  'aria-label': ariaLabel,
}: SliderProps<V>) {
  const isRange = Array.isArray(value);
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={onValueChange as (value: SliderValue) => void}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={styles.sliderRoot}
    >
      {/* Vertical padding widens the hit area past the 4px track. */}
      <BaseSlider.Control className={styles.sliderControl}>
        <BaseSlider.Track className={styles.sliderTrack}>
          <BaseSlider.Indicator className={styles.sliderIndicator} />
          {(isRange ? [0, 1] : [0]).map(index => (
            <BaseSlider.Thumb
              key={index}
              index={index}
              aria-label={
                isRange ? `${ariaLabel} ${index === 0 ? 'minimum' : 'maximum'}` : ariaLabel
              }
              className={`${styles.sliderThumb} ${focusRing}`}
            />
          ))}
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
