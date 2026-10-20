'use client';

import {
  Children,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

import {
  motionDefaults,
  type MotionStartMode,
  type MotionStyle,
} from './motionConfig';
import { useMotionInView } from './useMotionInView';

type MotionGroupElement = 'div' | 'footer' | 'header' | 'main' | 'section' | 'ul';
type MotionGroupPreset = 'fade-up' | 'scale' | 'slide-left' | 'slide-right';

export type MotionGroupProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  active?: boolean;
  as?: MotionGroupElement;
  children: ReactNode;
  delay?: number;
  disabled?: boolean;
  duration?: number;
  once?: boolean;
  preset?: MotionGroupPreset;
  rootMargin?: string;
  stagger?: number;
  start?: MotionStartMode;
  threshold?: number;
};

export default function MotionGroup({
  active = false,
  as = 'div',
  children,
  className,
  delay = 0,
  disabled = false,
  duration = motionDefaults.reveal.duration,
  once = true,
  preset = 'fade-up',
  rootMargin,
  stagger = 90,
  start = 'in-view',
  style,
  threshold,
  ...props
}: MotionGroupProps) {
  const Component = as;
  const { ref, isVisible } = useMotionInView({
    disabled: disabled || start !== 'in-view',
    once,
    rootMargin,
    threshold,
  });
  const isRenderedVisible =
    disabled ||
    (start === 'manual' ? active : start === 'immediate' ? true : isVisible);
  const motionStyle: MotionStyle = {
    '--motion-delay': `${delay}ms`,
    '--motion-duration': `${duration}ms`,
    '--motion-stagger': `${stagger}ms`,
    ...style,
  };

  return (
    <Component
      ref={ref as never}
      className={cn(
        'motion-group',
        `motion-group--${preset}`,
        isRenderedVisible && 'is-visible',
        disabled && 'motion-disabled',
        className,
      )}
      style={motionStyle}
      {...props}
    >
      {Children.map(children, (child, index) => (
        <span
          className='motion-group__item'
          style={{ '--motion-index': index } as CSSProperties}
        >
          {child}
        </span>
      ))}
    </Component>
  );
}
