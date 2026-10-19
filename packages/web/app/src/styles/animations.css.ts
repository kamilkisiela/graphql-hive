import {
  assignVars,
  createGlobalThemeContract,
  globalStyle,
  keyframes,
} from '@vanilla-extract/css';
import { theme } from './layers.css';
import { vars } from './theme.css';

/*
 * Keyframes and the `--animate-*` tokens that name them, ported from `index.css`. The token
 * names are Tailwind's, so `animate-shimmer` and friends resolve to these keyframes whether the
 * utility is still Tailwind's or already Vanilla Extract.
 */

export const spinnerSpin = keyframes({
  to: { transform: 'rotate(580deg)' },
});

export const spinnerArc = keyframes({
  '0%': { strokeDasharray: '16 46', strokeDashoffset: '0' },
  '50%': { strokeDasharray: '38 46', strokeDashoffset: '0' },
  '100%': { strokeDasharray: '16 46', strokeDashoffset: '-22' },
});

export const slideUpFade = keyframes({
  '0%': { opacity: 0, transform: 'translateY(2px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

export const slideRightFade = keyframes({
  '0%': { opacity: 0, transform: 'translateX(-2px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
});

export const slideDownFade = keyframes({
  '0%': { opacity: 0, transform: 'translateY(-2px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

export const slideLeftFade = keyframes({
  '0%': { opacity: 0, transform: 'translateX(2px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
});

export const skeletonIn = keyframes({
  from: { opacity: 0 },
});

export const shimmer = keyframes({
  from: { backgroundPosition: '0 0' },
  to: { backgroundPosition: '-200% 0' },
});

export const shake = keyframes({
  '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
  '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
  '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
  '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
});

export const animate = createGlobalThemeContract({
  slideUpFade: 'animate-slide-up-fade',
  slideRightFade: 'animate-slide-right-fade',
  slideDownFade: 'animate-slide-down-fade',
  slideLeftFade: 'animate-slide-left-fade',
  shimmer: 'animate-shimmer',
  skeleton: 'animate-skeleton',
  shake: 'animate-shake',
  spinnerSpin: 'animate-spinner-spin',
  spinnerArc: 'animate-spinner-arc',
});

const emphasized = 'cubic-bezier(0.16, 1, 0.3, 1)';

globalStyle(':root, :host', {
  '@layer': {
    [theme]: {
      vars: assignVars(animate, {
        slideUpFade: `${slideUpFade} 0.4s ${emphasized}`,
        slideRightFade: `${slideRightFade} 0.4s ${emphasized}`,
        slideDownFade: `${slideDownFade} 0.4s ${emphasized}`,
        slideLeftFade: `${slideLeftFade} 0.4s ${emphasized}`,
        shimmer: `${shimmer} 1.5s linear infinite`,
        skeleton: `${shimmer} 1.15s linear infinite, ${skeletonIn} 135ms ${vars.ease.authentic} both`,
        shake: `${shake} 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both`,
        spinnerSpin: `${spinnerSpin} 1.6s linear infinite`,
        spinnerArc: `${spinnerArc} 1.6s ${vars.ease.authentic} infinite`,
      }),
    },
  },
});
