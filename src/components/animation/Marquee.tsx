import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type MarqueeProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  direction?: 'left' | 'right';
  duration?: number;
  fadeEdges?: boolean;
  gap?: string;
  pauseOnHover?: boolean;
  repeat?: number;
};

type MarqueeStyle = CSSProperties & {
  '--marquee-duration'?: string;
  '--marquee-gap'?: string;
};

export default function Marquee({
  children,
  className,
  direction = 'left',
  duration = 24,
  fadeEdges = true,
  gap = '2rem',
  pauseOnHover = true,
  repeat = 6,
  style,
  ...props
}: MarqueeProps) {
  const items = Array.from({ length: Math.max(1, repeat) });

  return (
    <div
      className={cn(
        'marquee',
        `marquee--${direction}`,
        fadeEdges && 'marquee--fade',
        pauseOnHover && 'marquee--pause',
        className,
      )}
      style={
        {
          '--marquee-duration': `${duration}s`,
          '--marquee-gap': gap,
          ...style,
        } as MarqueeStyle
      }
      {...props}
    >
      <div className='marquee__inner'>
        <div className='marquee__track'>
          {items.map((_, index) => (
            <div className='marquee__item' key={`primary-${index}`}>
              {children}
            </div>
          ))}
        </div>
        <div aria-hidden='true' className='marquee__track'>
          {items.map((_, index) => (
            <div className='marquee__item' key={`clone-${index}`}>
              {children}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
