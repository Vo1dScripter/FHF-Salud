'use client';

import { type HTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { motionDefaults, type MotionStartMode } from './motionConfig';
import { useMotionInView } from './useMotionInView';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const DEFAULT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

type ScrambleElement = 'h1' | 'h2' | 'h3' | 'p' | 'span';

export type ScrambleTextProps = Omit<
  HTMLAttributes<HTMLElement>,
  'children'
> & {
  active?: boolean;
  as?: ScrambleElement;
  characters?: string;
  delay?: number;
  disabled?: boolean;
  duration?: number;
  once?: boolean;
  onComplete?: () => void;
  rootMargin?: string;
  start?: MotionStartMode;
  text: string;
  threshold?: number;
};

function scrambleFrame(text: string, progress: number, characters: string) {
  const lockedLength = Math.floor(text.length * progress);

  return Array.from(text)
    .map((character, index) => {
      if (/^\s$/.test(character) || index < lockedLength) {
        return character;
      }

      const randomIndex = Math.floor(Math.random() * characters.length);
      return characters[randomIndex] ?? character;
    })
    .join('');
}

export default function ScrambleText({
  active = false,
  as = 'span',
  characters = DEFAULT_CHARACTERS,
  className,
  delay = motionDefaults.text.delay,
  disabled = false,
  duration = 900,
  once = true,
  onComplete,
  rootMargin,
  start = 'in-view',
  text,
  threshold,
  ...props
}: ScrambleTextProps) {
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
  const shouldShowFinalText = disabled || prefersReducedMotion;
  const [value, setValue] = useState('');
  const renderedText = shouldShowFinalText ? text : shouldAnimate ? value : '';

  useEffect(() => {
    if (shouldShowFinalText) {
      return;
    }

    if (!shouldAnimate) {
      return;
    }

    const startedAt = performance.now() + delay;
    let animationFrame = 0;

    const animate = (now: number) => {
      if (now < startedAt) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min((now - startedAt) / duration, 1);
      setValue(scrambleFrame(text, progress, characters));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      setValue(text);
      onComplete?.();
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    characters,
    delay,
    duration,
    onComplete,
    shouldAnimate,
    shouldShowFinalText,
    text,
  ]);

  return (
    <Component
      ref={ref as never}
      className={cn('motion-scramble', className)}
      aria-label={text}
      {...props}
    >
      {renderedText}
    </Component>
  );
}
