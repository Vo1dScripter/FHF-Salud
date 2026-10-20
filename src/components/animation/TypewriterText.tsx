'use client';

import { type HTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { motionDefaults, type MotionStartMode } from './motionConfig';
import { useMotionInView } from './useMotionInView';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type TypewriterElement = 'h1' | 'h2' | 'h3' | 'p' | 'span';

export type TypewriterTextProps = Omit<
  HTMLAttributes<HTMLElement>,
  'children'
> & {
  active?: boolean;
  as?: TypewriterElement;
  cursor?: boolean;
  delay?: number;
  disabled?: boolean;
  loop?: boolean;
  once?: boolean;
  onComplete?: () => void;
  rootMargin?: string;
  speed?: number;
  start?: MotionStartMode;
  text: string;
  threshold?: number;
};

export default function TypewriterText({
  active = false,
  as = 'span',
  className,
  cursor = true,
  delay = motionDefaults.text.delay,
  disabled = false,
  loop = false,
  once = true,
  onComplete,
  rootMargin,
  speed = 42,
  start = 'in-view',
  text,
  threshold,
  ...props
}: TypewriterTextProps) {
  const Component = as;
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, isVisible } = useMotionInView({
    disabled: disabled || start !== 'in-view',
    once,
    rootMargin,
    threshold,
  });
  const shouldAnimate =
    !disabled &&
    !prefersReducedMotion &&
    (start === 'manual' ? active : start === 'immediate' ? true : isVisible);
  const shouldShowFullText = disabled || prefersReducedMotion;
  const [visibleText, setVisibleText] = useState('');
  const renderedText = shouldShowFullText ? text : shouldAnimate ? visibleText : '';

  useEffect(() => {
    if (shouldShowFullText) {
      return;
    }

    if (!shouldAnimate) {
      return;
    }

    let index = 0;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 1;
        setVisibleText(text.slice(0, index));

        if (index >= text.length) {
          if (loop) {
            index = 0;
            setVisibleText('');
            return;
          }

          if (interval) {
            window.clearInterval(interval);
          }
          onComplete?.();
        }
      }, speed);
    }, delay);

    return () => {
      window.clearTimeout(timeout);

      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [
    delay,
    loop,
    onComplete,
    shouldAnimate,
    shouldShowFullText,
    speed,
    text,
  ]);

  return (
    <Component
      ref={ref as never}
      className={cn('motion-typewriter', cursor && 'has-cursor', className)}
      {...props}
    >
      {renderedText}
    </Component>
  );
}
