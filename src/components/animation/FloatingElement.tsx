import { type CSSProperties, type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type FloatingElementProps = HTMLAttributes<HTMLDivElement> & {
  duration?: number;
  distance?: number;
};

type FloatingStyle = CSSProperties & {
  '--floating-distance'?: string;
  '--floating-duration'?: string;
};

export default function FloatingElement({
  children,
  className,
  distance = 12,
  duration = 4,
  style,
  ...props
}: FloatingElementProps) {
  return (
    <div
      className={cn('floating-element', className)}
      style={
        {
        '--floating-distance': `${distance}px`,
        '--floating-duration': `${duration}s`,
        ...style,
        } as FloatingStyle
      }
      {...props}
    >
      {children}
    </div>
  );
}
