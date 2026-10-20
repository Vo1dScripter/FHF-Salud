'use client';

import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import {
  motionDefaults,
  type MotionStyle,
  type MotionTimingProps,
  type RevealPreset,
  toMotionCssValue,
} from './motionConfig';
import { useMotionInView } from './useMotionInView';

type RevealElement =
  | 'article'
  | 'aside'
  | 'code'
  | 'div'
  | 'footer'
  | 'header'
  | 'li'
  | 'main'
  | 'p'
  | 'section'
  | 'span';

export type RevealProps = Omit<HTMLAttributes<HTMLElement>, 'children'> &
  MotionTimingProps & {
  as?: RevealElement;
  children: ReactNode;
  once?: boolean;
  preset?: RevealPreset;
  rootMargin?: string;
  threshold?: number;
};

export default function Reveal({
  as = 'div',
  children,
  className,
  delay = motionDefaults.reveal.delay,
  disabled = false,
  distance = motionDefaults.reveal.distance,
  duration = motionDefaults.reveal.duration,
  easing = motionDefaults.reveal.easing,
  initiallyVisible = false,
  once = true,
  preset = 'fade-up',
  rotate = motionDefaults.reveal.rotate,
  rootMargin,
  scale = motionDefaults.reveal.scale,
  style,
  threshold,
  ...props
}: RevealProps) {
  const Component = as;
  const { ref, isVisible } = useMotionInView({
    disabled,
    initiallyVisible,
    once,
    threshold,
    rootMargin,
  });

  const motionStyle: MotionStyle = {
    '--motion-delay': `${delay}ms`,
    '--motion-distance': toMotionCssValue(distance, 'px'),
    '--motion-duration': `${duration}ms`,
    '--motion-ease': easing,
    '--motion-rotate': toMotionCssValue(rotate, 'deg'),
    '--motion-scale': toMotionCssValue(scale, ''),
    ...style,
  };

  return (
    <Component
      ref={ref as never}
      className={cn(
        'motion-reveal',
        `motion-reveal--${preset}`,
        isVisible && 'is-visible',
        disabled && 'motion-disabled',
        className,
      )}
      style={motionStyle}
      {...props}
    >
      {children}
    </Component>
  );
}
