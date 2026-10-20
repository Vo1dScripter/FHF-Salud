import type { CSSProperties } from 'react';

export const revealPresets = [
  'blur-down',
  'blur-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'fade-up',
  'pop',
  'rotate',
  'scale',
] as const;

export const textPresets = [
  'blur-down',
  'blur-up',
  'clip-reveal',
  'edge-left',
  'edge-right',
  'fade',
  'flip',
  'highlight-sweep',
  'mask-up',
  'scale',
  'scramble',
  'slide-down',
  'slide-up',
  'swing',
  'typewriter',
  'wave',
] as const;

export const textSplits = ['chars', 'lines', 'words'] as const;
export const motionStartModes = ['immediate', 'in-view', 'manual'] as const;

export type MotionValue = number | string;
export type MotionStartMode = (typeof motionStartModes)[number];
export type RevealPreset = (typeof revealPresets)[number];
export type TextPreset = (typeof textPresets)[number];
export type TextSplit = (typeof textSplits)[number];

export type MotionStyle = CSSProperties & {
  '--motion-delay'?: string;
  '--motion-distance'?: string;
  '--motion-duration'?: string;
  '--motion-edge-distance'?: string;
  '--motion-ease'?: string;
  '--motion-highlight-color'?: string;
  '--motion-index'?: number;
  '--motion-rotate'?: string;
  '--motion-scale'?: string;
  '--motion-stagger'?: string;
};

export type MotionTimingProps = {
  delay?: number;
  disabled?: boolean;
  distance?: MotionValue;
  duration?: number;
  easing?: string;
  edgeDistance?: MotionValue;
  initiallyVisible?: boolean;
  rotate?: MotionValue;
  scale?: MotionValue;
};

export const motionDefaults = {
  observer: {
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.2,
  },
  reveal: {
    delay: 0,
    distance: 28,
    duration: 720,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    rotate: 12,
    scale: 0.88,
  },
  text: {
    delay: 0,
    distance: 22,
    duration: 700,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    edgeDistance: 'calc(50vw + 100%)',
    rotate: 14,
    scale: 0.78,
    stagger: 70,
  },
} as const;

export function toMotionCssValue(value: MotionValue, unit: string): string {
  return typeof value === 'number' ? `${value}${unit}` : value;
}
