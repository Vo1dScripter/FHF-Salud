'use client';

import { type HTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { motionDefaults } from './motionConfig';
import { useMotionInView } from './useMotionInView';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type CounterElement = 'dd' | 'div' | 'p' | 'span' | 'strong';

export type AnimatedCounterProps = Omit<
  HTMLAttributes<HTMLElement>,
  'children'
> & {
  as?: CounterElement;
  decimals?: number;
  delay?: number;
  duration?: number;
  from?: number;
  locale?: string;
  once?: boolean;
  prefix?: string;
  rootMargin?: string;
  suffix?: string;
  threshold?: number;
  to: number;
};

export default function AnimatedCounter({
  as = 'span',
  className,
  decimals = 0,
  delay = 0,
  duration = 1200,
  from = 0,
  locale = 'es-MX',
  once = true,
  prefix = '',
  rootMargin,
  suffix = '',
  threshold = motionDefaults.observer.threshold,
  to,
  ...props
}: AnimatedCounterProps) {
  const Component = as;
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, isVisible } = useMotionInView({ once, rootMargin, threshold });
  const [value, setValue] = useState(from);
  const renderedValue = prefersReducedMotion ? to : value;

  useEffect(() => {
    if (!isVisible || prefersReducedMotion) {
      return;
    }

    const startedAt = performance.now() + delay;
    let frame = 0;

    const animate = (now: number) => {
      if (now < startedAt) {
        frame = window.requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (to - from) * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [delay, duration, from, isVisible, prefersReducedMotion, to]);

  const formattedValue = new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(renderedValue);

  return (
    <Component ref={ref as never} className={cn('motion-counter', className)} {...props}>
      {prefix}
      {formattedValue}
      {suffix}
    </Component>
  );
}
