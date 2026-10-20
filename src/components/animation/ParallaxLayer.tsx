'use client';

import { type HTMLAttributes, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export type ParallaxLayerProps = HTMLAttributes<HTMLDivElement> & {
  speed?: number;
};

export default function ParallaxLayer({
  children,
  className,
  speed = 0.18,
  style,
  ...props
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const updateOffset = () => {
      const node = ref.current;

      if (!node) {
        return;
      }

      const bounds = node.getBoundingClientRect();
      setOffset((window.innerHeight / 2 - bounds.top) * speed);
    };

    updateOffset();
    window.addEventListener('scroll', updateOffset, { passive: true });
    window.addEventListener('resize', updateOffset);

    return () => {
      window.removeEventListener('scroll', updateOffset);
      window.removeEventListener('resize', updateOffset);
    };
  }, [speed]);

  return (
    <div
      ref={ref}
      className={cn('parallax-layer', className)}
      style={{
        transform: `translate3d(0, ${offset}px, 0)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
