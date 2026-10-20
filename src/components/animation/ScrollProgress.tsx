'use client';

import { type HTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export type ScrollProgressProps = HTMLAttributes<HTMLDivElement>;

export default function ScrollProgress({
  className,
  style,
  ...props
}: ScrollProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable <= 0 ? 0 : window.scrollY / scrollable);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, []);

  return (
    <div className={cn('scroll-progress', className)} {...props}>
      <span style={{ transform: `scaleX(${progress})`, ...style }} />
    </div>
  );
}
