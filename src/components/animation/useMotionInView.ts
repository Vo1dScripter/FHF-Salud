'use client';

import { useEffect, useRef, useState } from 'react';

import { motionDefaults } from './motionConfig';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export type UseMotionInViewOptions = {
  disabled?: boolean;
  initiallyVisible?: boolean;
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
};

export function useMotionInView({
  disabled = false,
  initiallyVisible = false,
  once = true,
  threshold = motionDefaults.observer.threshold,
  rootMargin = motionDefaults.observer.rootMargin,
}: UseMotionInViewOptions = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(disabled || initiallyVisible);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (disabled || prefersReducedMotion) {
      return;
    }

    const node = ref.current;

    if (!node) {
      return;
    }

    if (once && isVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.unobserve(node);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(node);

    return () => {
      observer.unobserve(node);
      observer.disconnect();
    };
  }, [disabled, isVisible, once, prefersReducedMotion, rootMargin, threshold]);

  return {
    ref,
    isVisible: isVisible || disabled || prefersReducedMotion,
  };
}
